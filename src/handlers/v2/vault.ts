import { V2Vault } from "generated";
import BigDecimal from "bignumber.js";
import { ZERO_BD, ZERO_ADDRESS, V2_VAULT_ADDRESS } from "../../utils/constants.js";
import { scaleDown, tokenToDecimal } from "../../utils/math.js";
import { makeChainId, defaultUser, defaultToken } from "../../utils/entities.js";
import {
  v2PoolTokenId,
  defaultV2BalancerSnapshot,
  defaultV2PoolSnapshot,
  v2SnapshotId,
  defaultV2Balancer,
} from "../../utils/v2/entities.js";
import {
  swapValueInUSD,
  valueInUSD,
  isPricingAsset,
  getPreferentialPricingAsset,
  getLatestPriceId,
  updateLatestPrice,
  addHistoricalPoolLiquidityRecord,
  updatePoolLiquidity,
} from "../../utils/v2/pricing.js";
import { isVariableWeightPool, isFXPoolType, isLinearPoolType } from "../../utils/v2/pools.js";
import { getWeights } from "../../effects/v2Pool.js";
import { USDC_ADDRESS } from "../../utils/v2/assets.js";

const DAY = 24 * 60 * 60;

// ================================
// Swap
// ================================

V2Vault.Swap.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const poolId = event.params.poolId;
  const poolAddress = poolId.slice(0, 42).toLowerCase();
  const poolEntityId = makeChainId(chainId, poolAddress);
  const tokenInAddress = event.params.tokenIn.toLowerCase();
  const tokenOutAddress = event.params.tokenOut.toLowerCase();

  let pool = await context.V2Pool.get(poolEntityId);
  if (!pool) return;

  // Ensure user exists
  const txFrom = event.transaction.from ?? ZERO_ADDRESS;
  const userId = makeChainId(chainId, txFrom);
  const user = await context.User.get(userId);
  if (!user) context.User.set(defaultUser(chainId, txFrom));

  // Load pool tokens
  const poolTokenInId = v2PoolTokenId(chainId, poolAddress, tokenInAddress);
  const poolTokenOutId = v2PoolTokenId(chainId, poolAddress, tokenOutAddress);
  const poolTokenIn = await context.V2PoolToken.get(poolTokenInId);
  const poolTokenOut = await context.V2PoolToken.get(poolTokenOutId);

  if (!poolTokenIn || !poolTokenOut) return;

  // Scale amounts
  const tokenAmountIn = tokenToDecimal(event.params.amountIn, poolTokenIn.decimals);
  const tokenAmountOut = tokenToDecimal(event.params.amountOut, poolTokenOut.decimals);

  // Variable weight pool updates (LBP/Investment/Managed) — weights change over time
  if (isVariableWeightPool(pool.poolType)) {
    const weights = await context.effect(getWeights, {
      address: poolAddress,
      chainId,
    });
    if (weights.length > 0) {
      const tokensList = pool.tokensList ?? [];
      // Filter out BPT from the token list (for Managed pools)
      const nonBptTokens = tokensList.filter((t: string) => t.toLowerCase() !== poolAddress);
      if (weights.length === nonBptTokens.length) {
        let totalWeight = ZERO_BD;
        for (let i = 0; i < nonBptTokens.length; i++) {
          const tokenAddr = nonBptTokens[i]!.toLowerCase();
          const weight = scaleDown(BigInt(weights[i]!), 18);
          totalWeight = totalWeight.plus(weight);

          const ptId = v2PoolTokenId(chainId, poolAddress, tokenAddr);
          const pt = await context.V2PoolToken.get(ptId);
          if (pt) {
            context.V2PoolToken.set({ ...pt, weight });
          }
        }
        // Update pool totalWeight (will be merged with other pool updates below)
        pool = { ...pool, totalWeight };
      }
    }
  }

  // Calculate swap value in USD
  const swapValue = await swapValueInUSD(
    tokenInAddress,
    tokenAmountIn,
    tokenOutAddress,
    tokenAmountOut,
    chainId,
    context,
  );

  // Determine if this is a join/exit swap (BPT is one of the tokens)
  const isJoinExitSwap = poolAddress === tokenInAddress || poolAddress === tokenOutAddress;

  // Calculate swap fees
  let swapFeesUSD = ZERO_BD;
  if (!isJoinExitSwap) {
    if (!isLinearPoolType(pool.poolType ?? "") && !isFXPoolType(pool.poolType)) {
      // Standard fee calculation
      swapFeesUSD = swapValue.times(pool.swapFee);
    } else if (isFXPoolType(pool.poolType)) {
      // FX pool custom fee calculation using latestFXPrice
      const usdcAddr = USDC_ADDRESS[chainId];
      const isTokenInBase = usdcAddr ? tokenOutAddress === usdcAddr : false;
      const baseTokenAddr = isTokenInBase ? tokenInAddress : tokenOutAddress;
      const quoteTokenAddr = isTokenInBase ? tokenOutAddress : tokenInAddress;

      const baseTokenId = makeChainId(chainId, baseTokenAddr);
      const quoteTokenId = makeChainId(chainId, quoteTokenAddr);
      const baseToken = await context.Token.get(baseTokenId);
      const quoteToken = await context.Token.get(quoteTokenId);

      const baseRate = baseToken?.latestFXPrice;
      const quoteRate = quoteToken?.latestFXPrice;

      if (baseRate && quoteRate) {
        if (isTokenInBase) {
          swapFeesUSD = tokenAmountIn.times(baseRate).minus(tokenAmountOut.times(quoteRate));
        } else {
          swapFeesUSD = tokenAmountIn.times(quoteRate).minus(tokenAmountOut.times(baseRate));
        }
        // Fees should not be negative
        if (swapFeesUSD.lt(ZERO_BD)) {
          swapFeesUSD = ZERO_BD;
        }
      }
    }
  }

  // Update pool token balances
  context.V2PoolToken.set({
    ...poolTokenIn,
    balance: poolTokenIn.balance.plus(tokenAmountIn),
  });
  context.V2PoolToken.set({
    ...poolTokenOut,
    balance: poolTokenOut.balance.minus(tokenAmountOut),
  });

  // Update pool stats
  context.V2Pool.set({
    ...pool,
    swapsCount: pool.swapsCount + 1n,
    totalSwapVolume: pool.totalSwapVolume.plus(isJoinExitSwap ? ZERO_BD : swapValue),
    totalSwapFee: pool.totalSwapFee.plus(swapFeesUSD),
  });

  // Create V2Swap entity
  const swapId = `${chainId}_${event.block.number}_${event.logIndex}`;
  context.V2Swap.set({
    id: swapId,
    caller: txFrom,
    tokenIn: tokenInAddress,
    tokenInSym: poolTokenIn.symbol,
    tokenOut: tokenOutAddress,
    tokenOutSym: poolTokenOut.symbol,
    tokenAmountIn,
    tokenAmountOut,
    valueUSD: swapValue,
    pool_id: poolEntityId,
    user_id: userId,
    timestamp: event.block.timestamp,
    block: BigInt(event.block.number),
    tx: event.transaction.hash ?? "",
  });

  // Update V2Balancer global stats
  const vaultId = makeChainId(chainId, V2_VAULT_ADDRESS);
  let vault = await context.V2Balancer.get(vaultId);
  if (!vault) {
    vault = defaultV2Balancer(chainId, V2_VAULT_ADDRESS);
  }
  const swapVolumeForMetrics = isJoinExitSwap ? ZERO_BD : swapValue;
  context.V2Balancer.set({
    ...vault,
    totalSwapCount: vault.totalSwapCount + 1n,
    totalSwapVolume: vault.totalSwapVolume.plus(swapVolumeForMetrics),
    totalSwapFee: vault.totalSwapFee.plus(swapFeesUSD),
  });

  // === Trade Pair tracking ===
  if (!isJoinExitSwap) {
    const tradePairResult = await getOrCreateTradePair(
      chainId, tokenInAddress, tokenOutAddress, context,
    );
    const updatedPair = {
      ...tradePairResult,
      totalSwapVolume: tradePairResult.totalSwapVolume.plus(swapVolumeForMetrics),
      totalSwapFee: tradePairResult.totalSwapFee.plus(swapFeesUSD),
    };
    context.V2TradePair.set(updatedPair);

    // Trade pair snapshot
    const tradePairSnapshot = await getOrCreateTradePairSnapshot(
      updatedPair.id, event.block.timestamp, context,
    );
    context.V2TradePairSnapshot.set({
      ...tradePairSnapshot,
      totalSwapVolume: updatedPair.totalSwapVolume,
      totalSwapFee: updatedPair.totalSwapFee,
    });
  }

  // === Pricing: update token prices from swap ===

  // Create TokenPrice for tokenIn (priced in tokenOut) if tokenOut is a pricing asset
  if (isPricingAsset(chainId, tokenOutAddress) && tokenAmountOut.gt(ZERO_BD)) {
    const price = tokenAmountOut.div(tokenAmountIn);
    const tokenPriceId = `${chainId}-${poolAddress}-${tokenInAddress}-${tokenOutAddress}-${event.block.number}`;
    const tokenPriceEntity = {
      id: tokenPriceId,
      pool_id: poolEntityId,
      asset: tokenInAddress,
      pricingAsset: tokenOutAddress,
      amount: tokenAmountIn,
      price,
      block: BigInt(event.block.number),
      timestamp: event.block.timestamp,
    };
    context.V2TokenPrice.set(tokenPriceEntity);
    await updateLatestPrice(tokenPriceEntity, event.block.timestamp, chainId, context);
  }

  // Create TokenPrice for tokenOut (priced in tokenIn) if tokenIn is a pricing asset
  if (isPricingAsset(chainId, tokenInAddress) && tokenAmountIn.gt(ZERO_BD)) {
    const price = tokenAmountIn.div(tokenAmountOut);
    const tokenPriceId = `${chainId}-${poolAddress}-${tokenOutAddress}-${tokenInAddress}-${event.block.number}`;
    const tokenPriceEntity = {
      id: tokenPriceId,
      pool_id: poolEntityId,
      asset: tokenOutAddress,
      pricingAsset: tokenInAddress,
      amount: tokenAmountOut,
      price,
      block: BigInt(event.block.number),
      timestamp: event.block.timestamp,
    };
    context.V2TokenPrice.set(tokenPriceEntity);
    await updateLatestPrice(tokenPriceEntity, event.block.timestamp, chainId, context);
  }

  // Update pool liquidity & historical record
  const pricingAsset = getPreferentialPricingAsset(chainId, [...(pool.tokensList ?? [])]);
  if (pricingAsset) {
    await addHistoricalPoolLiquidityRecord(
      poolEntityId,
      BigInt(event.block.number),
      pricingAsset,
      chainId,
      context,
    );
  }
  await updatePoolLiquidity(poolEntityId, event.block.number, event.block.timestamp, chainId, context);

  // Update snapshots
  await updateV2BalancerSnapshot(vault, event.block.timestamp, chainId, context);
});

// ================================
// Pool Balance Changed (Join/Exit)
// ================================

V2Vault.PoolBalanceChanged.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const poolId = event.params.poolId;
  const poolAddress = poolId.slice(0, 42).toLowerCase();
  const poolEntityId = makeChainId(chainId, poolAddress);

  const pool = await context.V2Pool.get(poolEntityId);
  if (!pool) return;

  const tokens = event.params.tokens;
  const deltas = event.params.deltas;
  const protocolFeeAmounts = event.params.protocolFeeAmounts;

  // Determine if join or exit by summing deltas
  let deltaSum = 0n;
  for (const delta of deltas) {
    deltaSum += delta;
  }
  const isJoin = deltaSum > 0n;

  // Ensure user exists
  const lpAddress = event.params.liquidityProvider.toLowerCase();
  const userId = makeChainId(chainId, lpAddress);
  const user = await context.User.get(userId);
  if (!user) context.User.set(defaultUser(chainId, lpAddress));

  // Update pool token balances and protocol fees
  const amounts: BigDecimal[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const tokenAddress = tokens[i]!.toLowerCase();
    const delta = deltas[i]!;
    const protocolFee = protocolFeeAmounts[i]!;

    const poolTokenId = v2PoolTokenId(chainId, poolAddress, tokenAddress);
    const poolToken = await context.V2PoolToken.get(poolTokenId);

    if (poolToken) {
      const deltaDecimal = tokenToDecimal(delta < 0n ? -delta : delta, poolToken.decimals);
      amounts.push(deltaDecimal);

      // Update balance: add delta (positive for join, negative for exit)
      const balanceDelta = scaleDown(delta, poolToken.decimals);
      const protocolFeeDecimal = tokenToDecimal(protocolFee, poolToken.decimals);

      context.V2PoolToken.set({
        ...poolToken,
        balance: poolToken.balance.plus(balanceDelta),
        paidProtocolFees: (poolToken.paidProtocolFees ?? ZERO_BD).plus(protocolFeeDecimal),
      });
    } else {
      const deltaDecimal = scaleDown(delta < 0n ? -delta : delta, 18);
      amounts.push(deltaDecimal);
    }
  }

  // Calculate valueUSD from token amounts
  let joinExitValueUSD = ZERO_BD;
  for (let i = 0; i < tokens.length; i++) {
    const tokenAddress = tokens[i]!.toLowerCase();
    const poolTokenId = v2PoolTokenId(chainId, poolAddress, tokenAddress);
    const poolToken = await context.V2PoolToken.get(poolTokenId);
    const decimals = poolToken?.decimals ?? 18;
    const delta = deltas[i]!;
    const absAmount = tokenToDecimal(delta < 0n ? -delta : delta, decimals);
    const tokenValueUSD = await valueInUSD(absAmount, tokenAddress, chainId, context);
    joinExitValueUSD = joinExitValueUSD.plus(tokenValueUSD);
  }

  // Create V2JoinExit entity
  const joinExitId = `${chainId}_${event.block.number}_${event.logIndex}`;
  context.V2JoinExit.set({
    id: joinExitId,
    type: isJoin ? "Join" : "Exit",
    sender: lpAddress,
    amounts,
    valueUSD: joinExitValueUSD,
    pool_id: poolEntityId,
    user_id: userId,
    timestamp: event.block.timestamp,
    tx: event.transaction.hash ?? "",
    block: BigInt(event.block.number),
  });

  // Update pool liquidity after join/exit
  await updatePoolLiquidity(poolEntityId, event.block.number, event.block.timestamp, chainId, context);
});

// ================================
// Pool Balance Managed
// ================================

V2Vault.PoolBalanceManaged.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const poolId = event.params.poolId;
  const poolAddress = poolId.slice(0, 42).toLowerCase();
  const tokenAddress = event.params.token.toLowerCase();

  const poolTokenId = v2PoolTokenId(chainId, poolAddress, tokenAddress);
  const poolToken = await context.V2PoolToken.get(poolTokenId);
  if (!poolToken) return;

  const cashDelta = scaleDown(event.params.cashDelta, poolToken.decimals);
  const managedDelta = scaleDown(event.params.managedDelta, poolToken.decimals);

  const newCashBalance = poolToken.cashBalance.plus(cashDelta);
  const newManagedBalance = poolToken.managedBalance.plus(managedDelta);
  const newBalance = newCashBalance.plus(newManagedBalance);

  context.V2PoolToken.set({
    ...poolToken,
    cashBalance: newCashBalance,
    managedBalance: newManagedBalance,
    balance: newBalance,
  });

  // Determine operation type
  let operationType: "Deposit" | "Withdraw" | "Update";
  if (event.params.cashDelta > 0n && event.params.managedDelta < 0n) {
    operationType = "Withdraw";
  } else if (event.params.cashDelta < 0n && event.params.managedDelta > 0n) {
    operationType = "Deposit";
  } else {
    operationType = "Update";
  }

  // Create V2ManagementOperation entity
  const operationId = `${chainId}_${event.block.number}_${event.logIndex}`;
  context.V2ManagementOperation.set({
    id: operationId,
    type: operationType,
    cashDelta,
    managedDelta,
    poolToken_id: poolTokenId,
    timestamp: event.block.timestamp,
  });

  // Update pool liquidity after balance management
  const poolEntityId = makeChainId(chainId, poolAddress);
  await updatePoolLiquidity(poolEntityId, event.block.number, event.block.timestamp, chainId, context);
});

// ================================
// Internal Balance Changed
// ================================

V2Vault.InternalBalanceChanged.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const userAddress = event.params.user.toLowerCase();
  const tokenAddress = event.params.token.toLowerCase();

  // Ensure user exists
  const userId = makeChainId(chainId, userAddress);
  const user = await context.User.get(userId);
  if (!user) context.User.set(defaultUser(chainId, userAddress));

  // Ensure token exists
  const tokenId = makeChainId(chainId, tokenAddress);
  let token = await context.Token.get(tokenId);
  if (!token) {
    token = defaultToken(chainId, tokenAddress);
    context.Token.set(token);
  }

  // Load or create V2UserInternalBalance
  const balanceId = `${chainId}-${userAddress}-${tokenAddress}`;
  let internalBalance = await context.V2UserInternalBalance.get(balanceId);

  const deltaDecimal = scaleDown(event.params.delta, token.decimals);

  if (!internalBalance) {
    internalBalance = {
      id: balanceId,
      user_id: userId,
      token: tokenAddress,
      tokenInfo_id: tokenId,
      balance: ZERO_BD,
    };
  }

  context.V2UserInternalBalance.set({
    ...internalBalance,
    balance: internalBalance.balance.plus(deltaDecimal),
  });
});

// ================================
// Helpers
// ================================

async function updateV2BalancerSnapshot(
  vault: any,
  timestamp: number,
  chainId: number,
  context: any,
) {
  const dayTimestamp = timestamp - (timestamp % DAY);
  const snapshotId = `${chainId}-${V2_VAULT_ADDRESS}-${dayTimestamp}`;

  let snapshot = await context.V2BalancerSnapshot.get(snapshotId);
  if (!snapshot) {
    snapshot = defaultV2BalancerSnapshot(chainId, V2_VAULT_ADDRESS, timestamp);
  }

  context.V2BalancerSnapshot.set({
    ...snapshot,
    poolCount: vault.poolCount,
    totalLiquidity: vault.totalLiquidity,
    totalSwapCount: vault.totalSwapCount,
    totalSwapVolume: vault.totalSwapVolume,
    totalSwapFee: vault.totalSwapFee,
    totalProtocolFee: vault.totalProtocolFee,
  });
}

/**
 * Get or create a V2TradePair entity. Token addresses are sorted
 * to ensure a canonical pair ID regardless of swap direction.
 */
async function getOrCreateTradePair(
  chainId: number,
  token0Address: string,
  token1Address: string,
  context: any,
) {
  const sorted = [token0Address, token1Address].sort();
  const tradePairId = `${chainId}-${sorted[0]}-${sorted[1]}`;

  let tradePair = await context.V2TradePair.get(tradePairId);
  if (!tradePair) {
    const token0Id = makeChainId(chainId, sorted[0]!);
    const token1Id = makeChainId(chainId, sorted[1]!);
    tradePair = {
      id: tradePairId,
      token0_id: token0Id,
      token1_id: token1Id,
      totalSwapVolume: ZERO_BD,
      totalSwapFee: ZERO_BD,
    };
  }
  return tradePair;
}

/**
 * Get or create a V2TradePairSnapshot for a given day.
 */
async function getOrCreateTradePairSnapshot(
  tradePairId: string,
  timestamp: number,
  context: any,
) {
  const dayID = Math.floor(timestamp / 86400);
  const dayTimestamp = dayID * 86400;
  const snapshotId = `${tradePairId}-${dayID}`;

  let snapshot = await context.V2TradePairSnapshot.get(snapshotId);
  if (!snapshot) {
    const tradePair = await context.V2TradePair.get(tradePairId);
    snapshot = {
      id: snapshotId,
      pair_id: tradePairId,
      timestamp: dayTimestamp,
      totalSwapVolume: tradePair ? tradePair.totalSwapVolume : ZERO_BD,
      totalSwapFee: tradePair ? tradePair.totalSwapFee : ZERO_BD,
    };
  }
  return snapshot;
}
