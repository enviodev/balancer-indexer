import {
  V3Vault,
  type V3Pool,
  type V3PoolToken,
  type V3Hook,
  type V3HookConfig,
  type V3LiquidityManagement,
  type V3RateProvider,
  type V3Buffer,
  type V3BufferShare,
  type V3Swap,
  type V3AddRemove,
  type Token,
  type User,
} from "generated";
import BigDecimal from "bignumber.js";
import { ZERO_ADDRESS, ZERO_BD, ZERO_BI, VAULT_ADDRESS, FEE_SCALING_FACTOR } from "../../utils/constants.js";
import { scaleDown, mulDownSwapFee, hexToBigInt, tokenToDecimal } from "../../utils/math.js";
import {
  makeChainId,
  defaultV3Vault,
  defaultV3Pool,
  defaultV3PoolToken,
  defaultUser,
  defaultToken,
  defaultV3PoolShare,
  getPoolTokenId,
  getPoolShareId,
  createSnapshotId,
  defaultV3PoolSnapshot,
} from "../../utils/entities.js";
import { getTokenMetadata } from "../../effects/erc20.js";
import { getProtocolFeeController, getStaticSwapFeePercentage, getPoolTokenBalances, getAggregateYieldFeeAmount, getERC4626Asset } from "../../effects/vault.js";

// ================================
// Pool Registration
// ================================

V3Vault.PoolRegistered.contractRegister(({ event, context }) => {
  context.addV3BPT(event.params.pool);
});

V3Vault.PoolRegistered.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const poolAddress = event.params.pool;
  const vaultId = makeChainId(chainId, event.srcAddress);

  // Ensure vault exists
  let vault = await context.V3Vault.get(vaultId);
  if (!vault) {
    const feeController = await context.effect(getProtocolFeeController, {
      vaultAddress: event.srcAddress,
      chainId,
    });
    vault = {
      ...defaultV3Vault(chainId, event.srcAddress),
      protocolFeeController: feeController,
    };
    context.V3Vault.set(vault);
  }

  const resolvedVault = vault!;

  // Get token metadata via effect
  const poolMeta = await context.effect(getTokenMetadata, {
    address: poolAddress,
    chainId,
  });

  // Get swap fee via effect
  const swapFeeRaw = await context.effect(getStaticSwapFeePercentage, {
    vaultAddress: event.srcAddress,
    poolAddress,
    chainId,
  });

  // Extract role accounts from the tuple
  const roleAccounts = event.params.roleAccounts;

  const pool: V3Pool = {
    ...defaultV3Pool(chainId, poolAddress),
    vault_id: vaultId,
    factory: event.params.factory,
    pauseWindowEndTime: event.params.pauseWindowEndTime,
    name: poolMeta.name,
    symbol: poolMeta.symbol,
    swapFee: scaleDown(BigInt(swapFeeRaw), 18),
    protocolSwapFee: resolvedVault.protocolSwapFee,
    protocolYieldFee: resolvedVault.protocolYieldFee,
    swapFeeManager: roleAccounts[0] as string,
    pauseManager: roleAccounts[1] as string,
    poolCreator: roleAccounts[2] as string,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash ?? "",
    hook_id: makeChainId(chainId, event.params.hooksConfig[0] as string),
    hookConfig_id: makeChainId(chainId, `${event.params.hooksConfig[0] as string}-${poolAddress}`),
    liquidityManagement_id: makeChainId(chainId, poolAddress),
  };

  // Create hook
  const hookAddress = event.params.hooksConfig[0] as string;
  const hookId = makeChainId(chainId, hookAddress);
  let hook = await context.V3Hook.get(hookId);
  if (!hook) {
    hook = { id: hookId, address: hookAddress };
    context.V3Hook.set(hook);
  }

  // Create hook config
  const hc = event.params.hooksConfig;
  const hookConfig: V3HookConfig = {
    id: makeChainId(chainId, `${hookAddress}-${poolAddress}`),
    pool_id: pool.id,
    hook_id: hookId,
    enableHookAdjustedAmounts: hc[1] as boolean,
    shouldCallBeforeInitialize: hc[2] as boolean,
    shouldCallAfterInitialize: hc[3] as boolean,
    shouldCallComputeDynamicSwapFee: hc[4] as boolean,
    shouldCallBeforeSwap: hc[5] as boolean,
    shouldCallAfterSwap: hc[6] as boolean,
    shouldCallBeforeAddLiquidity: hc[7] as boolean,
    shouldCallAfterAddLiquidity: hc[8] as boolean,
    shouldCallBeforeRemoveLiquidity: hc[9] as boolean,
    shouldCallAfterRemoveLiquidity: (hc as readonly unknown[])[10] !== undefined ? (hc as readonly unknown[])[10] as boolean : false,
  };
  context.V3HookConfig.set(hookConfig);

  // Create liquidity management
  const lm: V3LiquidityManagement = {
    id: makeChainId(chainId, poolAddress),
    pool_id: pool.id,
    disableUnbalancedLiquidity: event.params.liquidityManagement[0] as boolean,
    enableAddLiquidityCustom: event.params.liquidityManagement[1] as boolean,
    enableRemoveLiquidityCustom: event.params.liquidityManagement[2] as boolean,
    enableDonation: event.params.liquidityManagement[3] as boolean,
  };
  context.V3LiquidityManagement.set(lm);

  // Create pool tokens
  const tokenConfigs = event.params.tokenConfig;
  for (let i = 0; i < tokenConfigs.length; i++) {
    const tc = tokenConfigs[i]!;
    const tokenAddress = tc[0] as string;

    // Get token metadata
    const meta = await context.effect(getTokenMetadata, {
      address: tokenAddress,
      chainId,
    });

    // Create/update Token entity
    const tokenId = makeChainId(chainId, tokenAddress);
    const token: Token = {
      ...defaultToken(chainId, tokenAddress),
      name: meta.name,
      symbol: meta.symbol,
      decimals: meta.decimals,
    };
    context.Token.set(token);

    // Check for buffer
    const bufferId = makeChainId(chainId, tokenAddress);
    const existingBuffer = await context.V3Buffer.get(bufferId);

    // Check if token is a nested pool
    const nestedPool = await context.V3Pool.get(makeChainId(chainId, tokenAddress));

    const decimalDiff = 18 - meta.decimals;
    const poolToken: V3PoolToken = {
      ...defaultV3PoolToken(chainId, poolAddress, tokenAddress, i),
      name: meta.name,
      symbol: meta.symbol,
      decimals: meta.decimals,
      scalingFactor: 10n ** BigInt(decimalDiff),
      buffer_id: existingBuffer ? bufferId : undefined,
      nestedPool_id: nestedPool ? nestedPool.id : undefined,
      paysYieldFees: tc[3] as boolean,
    };
    context.V3PoolToken.set(poolToken);

    // Create rate provider
    const rateProviderAddress = tc[2] as string;
    const rateProviderId = makeChainId(chainId, `${poolAddress}-${tokenAddress}-${rateProviderAddress}`);
    const rateProvider: V3RateProvider = {
      id: rateProviderId,
      pool_id: pool.id,
      token_id: poolToken.id,
      address: rateProviderAddress,
    };
    context.V3RateProvider.set(rateProvider);
  }

  context.V3Pool.set(pool);

  // Create initial snapshot
  const timestamp = event.block.timestamp;
  const snapshot = defaultV3PoolSnapshot(chainId, poolAddress, timestamp);
  context.V3PoolSnapshot.set(snapshot);
});

// ================================
// Liquidity Added
// ================================

V3Vault.LiquidityAdded.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const poolAddress = event.params.pool;
  const poolId = makeChainId(chainId, poolAddress);

  const pool = await context.V3Pool.get(poolId);
  if (!pool) return;

  // Mark pool as initialized
  context.V3Pool.set({ ...pool, isInitialized: true });

  // Get updated balances
  const balancesRaw = await context.effect(getPoolTokenBalances, {
    vaultAddress: event.srcAddress,
    poolAddress,
    chainId,
    blockNumber: event.block.number,
  });

  // Update pool tokens
  const poolTokens = await context.V3PoolToken.getWhere({ pool_id: { _eq: poolId } });
  const joinAmounts: BigDecimal[] = [];

  for (let i = 0; i < poolTokens.length; i++) {
    const pt = poolTokens[i]!;
    const joinAmount = scaleDown(event.params.amountsAddedRaw[i]!, pt.decimals);
    joinAmounts.push(joinAmount);

    const newBalance = balancesRaw[i] ? scaleDown(BigInt(balancesRaw[i]!), pt.decimals) : pt.balance;

    const aggregateSwapFeeAmount = scaleDown(
      mulDownSwapFee(event.params.swapFeeAmountsRaw[i]!, pool.protocolSwapFee),
      pt.decimals
    );

    context.V3PoolToken.set({
      ...pt,
      balance: newBalance,
      vaultProtocolSwapFeeBalance: pt.vaultProtocolSwapFeeBalance.plus(aggregateSwapFeeAmount),
      totalProtocolSwapFee: pt.totalProtocolSwapFee.plus(aggregateSwapFeeAmount),
    });
  }

  // Create user
  const userId = makeChainId(chainId, event.params.liquidityProvider);
  const user = await context.User.get(userId);
  if (!user) context.User.set(defaultUser(chainId, event.params.liquidityProvider));

  // Create AddRemove entity
  const addRemoveId = `${chainId}_${event.block.number}_${event.logIndex}`;
  const addRemove: V3AddRemove = {
    id: addRemoveId,
    type: "Add",
    sender: event.params.liquidityProvider,
    amounts: joinAmounts,
    pool_id: poolId,
    user_id: userId,
    logIndex: BigInt(event.logIndex),
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash ?? "",
  };
  context.V3AddRemove.set(addRemove);

  // Update yield fees and snapshot
  await updateProtocolYieldFeeAmounts(pool, event.srcAddress, chainId, event.block.number, context);
  await createPoolSnapshot(pool, event.block.timestamp, chainId, context);
});

// ================================
// Liquidity Removed
// ================================

V3Vault.LiquidityRemoved.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const poolAddress = event.params.pool;
  const poolId = makeChainId(chainId, poolAddress);

  const pool = await context.V3Pool.get(poolId);
  if (!pool) return;

  const balancesRaw = await context.effect(getPoolTokenBalances, {
    vaultAddress: event.srcAddress,
    poolAddress,
    chainId,
    blockNumber: event.block.number,
  });

  const poolTokens = await context.V3PoolToken.getWhere({ pool_id: { _eq: poolId } });
  const exitAmounts: BigDecimal[] = [];

  for (let i = 0; i < poolTokens.length; i++) {
    const pt = poolTokens[i]!;
    const exitAmount = scaleDown(event.params.amountsRemovedRaw[i]!, pt.decimals);
    exitAmounts.push(exitAmount);

    const newBalance = balancesRaw[i] ? scaleDown(BigInt(balancesRaw[i]!), pt.decimals) : pt.balance;

    const aggregateSwapFeeAmount = scaleDown(
      mulDownSwapFee(event.params.swapFeeAmountsRaw[i]!, pool.protocolSwapFee),
      pt.decimals
    );

    context.V3PoolToken.set({
      ...pt,
      balance: newBalance,
      vaultProtocolSwapFeeBalance: pt.vaultProtocolSwapFeeBalance.plus(aggregateSwapFeeAmount),
      totalProtocolSwapFee: pt.totalProtocolSwapFee.plus(aggregateSwapFeeAmount),
    });
  }

  const userId = makeChainId(chainId, event.params.liquidityProvider);
  const user = await context.User.get(userId);
  if (!user) context.User.set(defaultUser(chainId, event.params.liquidityProvider));

  const addRemoveId = `${chainId}_${event.block.number}_${event.logIndex}`;
  const addRemove: V3AddRemove = {
    id: addRemoveId,
    type: "Remove",
    sender: event.params.liquidityProvider,
    amounts: exitAmounts,
    pool_id: poolId,
    user_id: userId,
    logIndex: BigInt(event.logIndex),
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash ?? "",
  };
  context.V3AddRemove.set(addRemove);

  await updateProtocolYieldFeeAmounts(pool, event.srcAddress, chainId, event.block.number, context);
  await createPoolSnapshot(pool, event.block.timestamp, chainId, context);
});

// ================================
// Swap
// ================================

V3Vault.Swap.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const poolAddress = event.params.pool;
  const poolId = makeChainId(chainId, poolAddress);

  // Ensure user
  const txFrom = event.transaction.from ?? ZERO_ADDRESS;
  const userId = makeChainId(chainId, txFrom);
  const user = await context.User.get(userId);
  if (!user) context.User.set(defaultUser(chainId, txFrom));

  const pool = await context.V3Pool.get(poolId);
  if (!pool) return;

  // Update swaps count
  context.V3Pool.set({ ...pool, swapsCount: pool.swapsCount + 1n });

  // Get token info
  const tokenInId = makeChainId(chainId, event.params.tokenIn);
  const tokenOutId = makeChainId(chainId, event.params.tokenOut);

  let tokenIn = await context.Token.get(tokenInId);
  if (!tokenIn) {
    const meta = await context.effect(getTokenMetadata, { address: event.params.tokenIn, chainId });
    tokenIn = { ...defaultToken(chainId, event.params.tokenIn), ...meta };
    context.Token.set(tokenIn);
  }
  let tokenOut = await context.Token.get(tokenOutId);
  if (!tokenOut) {
    const meta = await context.effect(getTokenMetadata, { address: event.params.tokenOut, chainId });
    tokenOut = { ...defaultToken(chainId, event.params.tokenOut), ...meta };
    context.Token.set(tokenOut);
  }

  const tokenAmountIn = scaleDown(event.params.amountIn, tokenIn.decimals);
  const tokenAmountOut = scaleDown(event.params.amountOut, tokenOut.decimals);
  const swapFeeAmount = scaleDown(event.params.swapFeeAmount, tokenIn.decimals);
  const swapFeePercentage = scaleDown(event.params.swapFeePercentage, 18);

  const hasDynamicSwapFee = !pool.swapFee.eq(swapFeePercentage);
  let swapFeeBaseAmount = swapFeeAmount;
  let swapFeeDeltaAmount = ZERO_BD;
  if (hasDynamicSwapFee) {
    swapFeeBaseAmount = scaleDown(
      mulDownSwapFee(event.params.amountIn, pool.swapFee),
      tokenIn.decimals
    );
    const swapFeeDelta = swapFeePercentage.minus(pool.swapFee);
    swapFeeDeltaAmount = scaleDown(
      mulDownSwapFee(event.params.amountIn, swapFeeDelta),
      tokenIn.decimals
    );
  }

  const swapId = `${chainId}_${event.block.number}_${event.logIndex}`;
  const swap: V3Swap = {
    id: swapId,
    pool: poolAddress,
    tokenIn: event.params.tokenIn,
    tokenInSymbol: tokenIn.symbol,
    tokenAmountIn,
    tokenOut: event.params.tokenOut,
    tokenOutSymbol: tokenOut.symbol,
    tokenAmountOut,
    swapFeeAmount,
    swapFeeBaseAmount,
    swapFeeDeltaAmount,
    swapFeeToken: event.params.tokenIn,
    swapFeePercentage,
    hasDynamicSwapFee,
    user_id: userId,
    logIndex: BigInt(event.logIndex),
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash ?? "",
  };
  context.V3Swap.set(swap);

  // Update pool tokens
  const poolTokenInId = getPoolTokenId(chainId, poolAddress, event.params.tokenIn);
  const poolTokenOutId = getPoolTokenId(chainId, poolAddress, event.params.tokenOut);
  const poolTokenIn = await context.V3PoolToken.get(poolTokenInId);
  const poolTokenOut = await context.V3PoolToken.get(poolTokenOutId);

  if (!poolTokenIn || !poolTokenOut) return;

  const balancesRaw = await context.effect(getPoolTokenBalances, {
    vaultAddress: event.srcAddress,
    poolAddress,
    chainId,
    blockNumber: event.block.number,
  });

  const aggregateSwapFeeAmount = scaleDown(
    mulDownSwapFee(event.params.swapFeeAmount, pool.protocolSwapFee),
    poolTokenIn.decimals
  );

  const newBalanceIn = balancesRaw[poolTokenIn.index]
    ? scaleDown(BigInt(balancesRaw[poolTokenIn.index]!), poolTokenIn.decimals)
    : poolTokenIn.balance;

  context.V3PoolToken.set({
    ...poolTokenIn,
    balance: newBalanceIn,
    volume: poolTokenIn.volume.plus(tokenAmountIn),
    totalSwapFee: poolTokenIn.totalSwapFee.plus(swapFeeAmount),
    totalSwapFeeBase: poolTokenIn.totalSwapFeeBase.plus(swapFeeBaseAmount),
    totalStaticSwapFee: poolTokenIn.totalStaticSwapFee.plus(swapFeeAmount),
    totalDynamicSwapFee: hasDynamicSwapFee
      ? poolTokenIn.totalDynamicSwapFee.plus(swapFeeAmount)
      : poolTokenIn.totalDynamicSwapFee,
    vaultProtocolSwapFeeBalance: poolTokenIn.vaultProtocolSwapFeeBalance.plus(aggregateSwapFeeAmount),
    totalProtocolSwapFee: poolTokenIn.totalProtocolSwapFee.plus(aggregateSwapFeeAmount),
  });

  const newBalanceOut = balancesRaw[poolTokenOut.index]
    ? scaleDown(BigInt(balancesRaw[poolTokenOut.index]!), poolTokenOut.decimals)
    : poolTokenOut.balance;

  context.V3PoolToken.set({
    ...poolTokenOut,
    balance: newBalanceOut,
    volume: poolTokenOut.volume.plus(tokenAmountOut),
  });

  await updateProtocolYieldFeeAmounts(pool, event.srcAddress, chainId, event.block.number, context);
  await createPoolSnapshot(pool, event.block.timestamp, chainId, context);
});

// ================================
// Buffer Events
// ================================

V3Vault.LiquidityAddedToBuffer.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const wrappedTokenAddress = event.params.wrappedToken;
  const bufferId = makeChainId(chainId, wrappedTokenAddress);

  let buffer = await context.V3Buffer.get(bufferId);
  if (!buffer) {
    const underlyingAddress = await context.effect(getERC4626Asset, {
      address: wrappedTokenAddress,
      chainId,
    });
    const underlying = underlyingAddress ?? ZERO_ADDRESS;

    const wrappedMeta = await context.effect(getTokenMetadata, { address: wrappedTokenAddress, chainId });
    const underlyingMeta = await context.effect(getTokenMetadata, { address: underlying, chainId });

    context.Token.set({ ...defaultToken(chainId, wrappedTokenAddress), ...wrappedMeta });
    context.Token.set({ ...defaultToken(chainId, underlying), ...underlyingMeta });

    buffer = {
      id: bufferId,
      wrappedToken_id: makeChainId(chainId, wrappedTokenAddress),
      underlyingToken_id: makeChainId(chainId, underlying),
      wrappedBalance: ZERO_BD,
      underlyingBalance: ZERO_BD,
      totalShares: ZERO_BD,
    };
  }

  const wrappedToken = await context.Token.get(buffer.wrappedToken_id);
  const underlyingToken = await context.Token.get(buffer.underlyingToken_id);

  const amountWrapped = scaleDown(event.params.amountWrapped, wrappedToken?.decimals ?? 18);
  const amountUnderlying = scaleDown(event.params.amountUnderlying, underlyingToken?.decimals ?? 18);

  context.V3Buffer.set({
    ...buffer,
    wrappedBalance: buffer.wrappedBalance.plus(amountWrapped),
    underlyingBalance: buffer.underlyingBalance.plus(amountUnderlying),
  });
});

V3Vault.LiquidityRemovedFromBuffer.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const bufferId = makeChainId(chainId, event.params.wrappedToken);

  const buffer = await context.V3Buffer.get(bufferId);
  if (!buffer) return;

  const wrappedToken = await context.Token.get(buffer.wrappedToken_id);
  const underlyingToken = await context.Token.get(buffer.underlyingToken_id);

  const amountWrapped = scaleDown(event.params.amountWrapped, wrappedToken?.decimals ?? 18);
  const amountUnderlying = scaleDown(event.params.amountUnderlying, underlyingToken?.decimals ?? 18);

  context.V3Buffer.set({
    ...buffer,
    wrappedBalance: buffer.wrappedBalance.minus(amountWrapped),
    underlyingBalance: buffer.underlyingBalance.minus(amountUnderlying),
  });
});

V3Vault.BufferSharesMinted.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const userId = makeChainId(chainId, event.params.to);
  const user = await context.User.get(userId);
  if (!user) context.User.set(defaultUser(chainId, event.params.to));

  const bufferId = makeChainId(chainId, event.params.wrappedToken);
  const buffer = await context.V3Buffer.get(bufferId);
  if (!buffer) return;

  const wrappedToken = await context.Token.get(buffer.wrappedToken_id);
  const issuedShares = scaleDown(event.params.issuedShares, wrappedToken?.decimals ?? 18);

  context.V3Buffer.set({ ...buffer, totalShares: buffer.totalShares.plus(issuedShares) });

  const shareId = `${bufferId}-${event.params.to}`;
  let share = await context.V3BufferShare.get(shareId);
  if (!share) {
    share = { id: shareId, user_id: userId, buffer_id: bufferId, balance: ZERO_BD };
  }
  context.V3BufferShare.set({ ...share, balance: share.balance.plus(issuedShares) });
});

V3Vault.BufferSharesBurned.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const userId = makeChainId(chainId, event.params.from);
  const user = await context.User.get(userId);
  if (!user) context.User.set(defaultUser(chainId, event.params.from));

  const bufferId = makeChainId(chainId, event.params.wrappedToken);
  const buffer = await context.V3Buffer.get(bufferId);
  if (!buffer) return;

  const wrappedToken = await context.Token.get(buffer.wrappedToken_id);
  const burnedShares = scaleDown(event.params.burnedShares, wrappedToken?.decimals ?? 18);

  context.V3Buffer.set({ ...buffer, totalShares: buffer.totalShares.minus(burnedShares) });

  const shareId = `${bufferId}-${event.params.from}`;
  let share = await context.V3BufferShare.get(shareId);
  if (!share) {
    share = { id: shareId, user_id: userId, buffer_id: bufferId, balance: ZERO_BD };
  }
  context.V3BufferShare.set({ ...share, balance: share.balance.minus(burnedShares) });
});

V3Vault.Wrap.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const bufferId = makeChainId(chainId, event.params.wrappedToken);
  const buffer = await context.V3Buffer.get(bufferId);
  if (!buffer) return;

  const wrappedToken = await context.Token.get(buffer.wrappedToken_id);
  const underlyingToken = await context.Token.get(buffer.underlyingToken_id);

  const bufferBalancesHex = event.params.bufferBalances.slice(2);
  const wrappedBalanceHex = bufferBalancesHex.slice(0, 32);
  const underlyingBalanceHex = bufferBalancesHex.slice(32, 64);

  context.V3Buffer.set({
    ...buffer,
    wrappedBalance: scaleDown(hexToBigInt(wrappedBalanceHex), underlyingToken?.decimals ?? 18),
    underlyingBalance: scaleDown(hexToBigInt(underlyingBalanceHex), wrappedToken?.decimals ?? 18),
  });
});

V3Vault.Unwrap.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const bufferId = makeChainId(chainId, event.params.wrappedToken);
  const buffer = await context.V3Buffer.get(bufferId);
  if (!buffer) return;

  const wrappedToken = await context.Token.get(buffer.wrappedToken_id);
  const underlyingToken = await context.Token.get(buffer.underlyingToken_id);

  const bufferBalancesHex = event.params.bufferBalances.slice(2);
  const wrappedBalanceHex = bufferBalancesHex.slice(0, 32);
  const underlyingBalanceHex = bufferBalancesHex.slice(32, 64);

  context.V3Buffer.set({
    ...buffer,
    underlyingBalance: scaleDown(hexToBigInt(underlyingBalanceHex), wrappedToken?.decimals ?? 18),
    wrappedBalance: scaleDown(hexToBigInt(wrappedBalanceHex), underlyingToken?.decimals ?? 18),
  });
});

// ================================
// Pool State Changes
// ================================

V3Vault.SwapFeePercentageChanged.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const poolId = makeChainId(chainId, event.params.pool);
  const pool = await context.V3Pool.get(poolId);
  if (!pool) return;

  // Replicate smart contract rounding behavior
  const roundedSwapFee = (event.params.swapFeePercentage / FEE_SCALING_FACTOR) * FEE_SCALING_FACTOR;
  context.V3Pool.set({ ...pool, swapFee: scaleDown(roundedSwapFee, 18) });
});

V3Vault.PoolRecoveryModeStateChanged.handler(async ({ event, context }) => {
  const poolId = makeChainId(event.chainId, event.params.pool);
  const pool = await context.V3Pool.get(poolId);
  if (!pool) return;
  context.V3Pool.set({ ...pool, isInRecoveryMode: event.params.recoveryMode });
});

V3Vault.PoolPausedStateChanged.handler(async ({ event, context }) => {
  const poolId = makeChainId(event.chainId, event.params.pool);
  const pool = await context.V3Pool.get(poolId);
  if (!pool) return;
  context.V3Pool.set({ ...pool, isPaused: event.params.paused });
});

V3Vault.ProtocolFeeControllerChanged.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const vaultId = makeChainId(chainId, event.srcAddress);
  const vault = await context.V3Vault.get(vaultId);
  if (!vault) return;
  context.V3Vault.set({ ...vault, protocolFeeController: event.params.newProtocolFeeController });
});

// ================================
// Helpers
// ================================

async function updateProtocolYieldFeeAmounts(
  pool: V3Pool,
  vaultAddress: string,
  chainId: number,
  blockNumber: number,
  context: any
) {
  const poolTokens = await context.V3PoolToken.getWhere({ pool_id: { _eq: pool.id } });

  for (const pt of poolTokens) {
    if (!pt.paysYieldFees) continue;

    const yieldFeeRaw = await context.effect(getAggregateYieldFeeAmount, {
      vaultAddress,
      poolAddress: pool.address,
      tokenAddress: pt.address,
      chainId,
      blockNumber,
    });

    if (!yieldFeeRaw) continue;

    const yieldFeeAmount = scaleDown(BigInt(yieldFeeRaw), pt.decimals);
    const deltaYieldFee = yieldFeeAmount.minus(pt.vaultProtocolYieldFeeBalance);

    context.V3PoolToken.set({
      ...pt,
      vaultProtocolYieldFeeBalance: yieldFeeAmount,
      totalProtocolYieldFee: pt.totalProtocolYieldFee.plus(deltaYieldFee),
    });
  }
}

async function createPoolSnapshot(
  pool: V3Pool,
  timestamp: number,
  chainId: number,
  context: any
) {
  const snapshotId = createSnapshotId(chainId, pool.address, timestamp);
  const DAY = 24 * 60 * 60;
  const dayTimestamp = timestamp - (timestamp % DAY);

  const poolTokens = await context.V3PoolToken.getWhere({ pool_id: { _eq: pool.id } });

  // Sort by index to ensure consistent ordering
  poolTokens.sort((a: V3PoolToken, b: V3PoolToken) => a.index - b.index);

  const snapshot = {
    id: snapshotId,
    pool_id: pool.id,
    timestamp: dayTimestamp,
    totalShares: pool.totalShares,
    swapsCount: pool.swapsCount,
    holdersCount: pool.holdersCount,
    balances: poolTokens.map((pt: V3PoolToken) => pt.balance),
    totalSwapFees: poolTokens.map((pt: V3PoolToken) => pt.totalSwapFee),
    totalStaticSwapFees: poolTokens.map((pt: V3PoolToken) => pt.totalStaticSwapFee),
    totalDynamicSwapFees: poolTokens.map((pt: V3PoolToken) => pt.totalDynamicSwapFee),
    totalSwapVolumes: poolTokens.map((pt: V3PoolToken) => pt.volume),
    totalProtocolSwapFees: poolTokens.map((pt: V3PoolToken) => pt.totalProtocolSwapFee),
    totalProtocolYieldFees: poolTokens.map((pt: V3PoolToken) => pt.totalProtocolYieldFee),
  };

  context.V3PoolSnapshot.set(snapshot);
}
