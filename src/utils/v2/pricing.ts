import BigDecimal from "bignumber.js";
import { ZERO_BD, ONE_BD, V2_VAULT_ADDRESS } from "../constants.js";
import { makeChainId } from "../entities.js";
import {
  v2PoolTokenId,
  defaultV2Balancer,
  defaultV2PoolSnapshot,
  v2SnapshotId,
  defaultV2BalancerSnapshot,
} from "./entities.js";

// ================================
// Constants
// ================================

const MIN_POOL_LIQUIDITY = new BigDecimal(2000);
const MIN_SWAP_VALUE_USD = new BigDecimal(1);
const MAX_POS_PRICE_CHANGE = new BigDecimal(1); // 100%
const MAX_NEG_PRICE_CHANGE = new BigDecimal("-0.5"); // -50%
const MAX_TIME_DIFF_FOR_PRICING = 600; // seconds
const DAY = 24 * 60 * 60;

// ================================
// Pricing Assets — tokens used as pricing references for USD value calculations
// ================================

const PRICING_ASSETS: Record<number, string[]> = {
  // Ethereum
  1: [
    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // WETH
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC
    "0x6b175474e89094c44da98b954eedeac495271d0f", // DAI
    "0xdac17f958d2ee523a2206206994597c13d831ec7", // USDT
    "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599", // WBTC
    "0xba100000625a3754423978a60c9317c58a424e3d", // BAL
  ],
  // Polygon
  137: [
    "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270", // WMATIC
    "0x2791bca1f2de4661ed88a30c99a7a9449aa84174", // USDC
    "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619", // WETH
    "0x8f3cf7ad23cd3cadbd9735aff958023239c6a063", // DAI
  ],
  // Arbitrum
  42161: [
    "0x82af49447d8a07e3bd95bd0d56f35241523fbab1", // WETH
    "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8", // USDC
    "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9", // USDT
    "0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f", // WBTC
  ],
  // Gnosis
  100: [
    "0xe91d153e0b41518a2ce8dd3d7944fa863463a97d", // WXDAI
    "0x6a023ccd1ff6f2045c3309768ead9e68f978f6e1", // WETH
  ],
  // Base
  8453: [
    "0x4200000000000000000000000000000000000006", // WETH
    "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // USDC
  ],
  // Optimism
  10: [
    "0x4200000000000000000000000000000000000006", // WETH
    "0x7f5c764cbc14f9669b88837ca1490cca17c31607", // USDC
    "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1", // DAI
  ],
  // Avalanche
  43114: [
    "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7", // WAVAX
    "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e", // USDC
    "0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab", // WETH
  ],
};

const PRICING_ASSETS_SETS: Record<number, Set<string>> = {};
for (const [chainId, assets] of Object.entries(PRICING_ASSETS)) {
  PRICING_ASSETS_SETS[Number(chainId)] = new Set(assets);
}

// ================================
// USD Stable Assets — subset of pricing assets that are stablecoins
// ================================

const USD_STABLE_ASSETS: Record<number, Set<string>> = {
  // Ethereum: USDC, DAI, USDT
  1: new Set([
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC
    "0x6b175474e89094c44da98b954eedeac495271d0f", // DAI
    "0xdac17f958d2ee523a2206206994597c13d831ec7", // USDT
  ]),
  // Polygon: USDC, DAI
  137: new Set([
    "0x2791bca1f2de4661ed88a30c99a7a9449aa84174", // USDC
    "0x8f3cf7ad23cd3cadbd9735aff958023239c6a063", // DAI
  ]),
  // Arbitrum: USDC, USDT
  42161: new Set([
    "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8", // USDC
    "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9", // USDT
  ]),
  // Gnosis: WXDAI
  100: new Set([
    "0xe91d153e0b41518a2ce8dd3d7944fa863463a97d", // WXDAI
  ]),
  // Base: USDC
  8453: new Set([
    "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // USDC
  ]),
  // Optimism: USDC, DAI
  10: new Set([
    "0x7f5c764cbc14f9669b88837ca1490cca17c31607", // USDC
    "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1", // DAI
  ]),
  // Avalanche: USDC
  43114: new Set([
    "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e", // USDC
  ]),
};

// ================================
// Pool types with virtual supply
// ================================

const VIRTUAL_SUPPLY_POOL_TYPES = new Set([
  "ComposableStable",
  "StablePhantom",
  "AaveLinear",
  "ERC4626Linear",
  "EulerLinear",
  "GearboxLinear",
  "MidasLinear",
  "ReaperLinear",
  "SiloLinear",
  "TetuLinear",
  "YearnLinear",
  "FranklinLinear",
  "Linear",
]);

export function hasVirtualSupply(poolType: string | undefined): boolean {
  if (!poolType) return false;
  return VIRTUAL_SUPPLY_POOL_TYPES.has(poolType);
}

// ================================
// Pure Functions
// ================================

/**
 * Check if a token is a pricing asset on the given chain
 */
export function isPricingAsset(chainId: number, tokenAddress: string): boolean {
  const assets = PRICING_ASSETS_SETS[chainId];
  if (!assets) return false;
  return assets.has(tokenAddress.toLowerCase());
}

/**
 * Check if a token is a USD-pegged stablecoin on the given chain
 */
export function isUSDStable(chainId: number, tokenAddress: string): boolean {
  const assets = USD_STABLE_ASSETS[chainId];
  if (!assets) return false;
  return assets.has(tokenAddress.toLowerCase());
}

/**
 * Generate a deterministic ID for a LatestPrice entity
 */
export function getLatestPriceId(chainId: number, tokenAddress: string, pricingAsset: string): string {
  return `${chainId}-${tokenAddress}-${pricingAsset}`;
}

/**
 * Return the first token from tokenAddresses that is a pricing asset,
 * ordered by PRICING_ASSETS priority for the given chain.
 * Returns null if none of the tokens are pricing assets.
 */
export function getPreferentialPricingAsset(chainId: number, tokenAddresses: string[]): string | null {
  const assets = PRICING_ASSETS[chainId];
  if (!assets) return null;

  const addressSet = new Set(tokenAddresses.map((a) => a.toLowerCase()));

  // Return the first pricing asset (by priority order) that appears in tokenAddresses
  for (const pricingAsset of assets) {
    if (addressSet.has(pricingAsset)) {
      return pricingAsset;
    }
  }
  return null;
}

// ================================
// Async Functions (require context)
// ================================

/**
 * Calculate the USD value of a given amount of a token.
 * - If the token is a USD stablecoin, return the amount directly (1:1 peg).
 * - Otherwise, load the Token entity and multiply by its latestUSDPrice.
 */
export async function valueInUSD(
  amount: BigDecimal,
  tokenAddress: string,
  chainId: number,
  context: any,
): Promise<BigDecimal> {
  const addr = tokenAddress.toLowerCase();

  if (isUSDStable(chainId, addr)) {
    return amount;
  }

  const tokenId = makeChainId(chainId, addr);
  const token = await context.Token.get(tokenId);

  if (token && token.latestUSDPrice) {
    return amount.times(token.latestUSDPrice);
  }

  return ZERO_BD;
}

/**
 * Calculate the USD value of a swap using the best available pricing.
 * Priority:
 *   1. If tokenOut is a USD stablecoin → use amountOut
 *   2. If tokenIn is a USD stablecoin → use amountIn
 *   3. If one side is a pricing asset → use that side's valueInUSD
 *   4. If both sides have prices → average them
 *   5. Otherwise return ZERO_BD
 */
export async function swapValueInUSD(
  tokenInAddress: string,
  amountIn: BigDecimal,
  tokenOutAddress: string,
  amountOut: BigDecimal,
  chainId: number,
  context: any,
): Promise<BigDecimal> {
  const tokenInAddr = tokenInAddress.toLowerCase();
  const tokenOutAddr = tokenOutAddress.toLowerCase();

  // Priority 1: tokenOut is a USD stable
  if (isUSDStable(chainId, tokenOutAddr)) {
    return amountOut;
  }

  // Priority 2: tokenIn is a USD stable
  if (isUSDStable(chainId, tokenInAddr)) {
    return amountIn;
  }

  // Priority 3: one side is a pricing asset
  const tokenInIsPricing = isPricingAsset(chainId, tokenInAddr);
  const tokenOutIsPricing = isPricingAsset(chainId, tokenOutAddr);

  if (tokenOutIsPricing && !tokenInIsPricing) {
    const value = await valueInUSD(amountOut, tokenOutAddr, chainId, context);
    if (value.gt(MIN_SWAP_VALUE_USD)) return value;
  }

  if (tokenInIsPricing && !tokenOutIsPricing) {
    const value = await valueInUSD(amountIn, tokenInAddr, chainId, context);
    if (value.gt(MIN_SWAP_VALUE_USD)) return value;
  }

  // Priority 4: both sides have a price — average
  const valueIn = await valueInUSD(amountIn, tokenInAddr, chainId, context);
  const valueOut = await valueInUSD(amountOut, tokenOutAddr, chainId, context);

  if (valueIn.gt(MIN_SWAP_VALUE_USD) && valueOut.gt(MIN_SWAP_VALUE_USD)) {
    return valueIn.plus(valueOut).div(new BigDecimal(2));
  }

  // One side priced
  if (valueIn.gt(MIN_SWAP_VALUE_USD)) return valueIn;
  if (valueOut.gt(MIN_SWAP_VALUE_USD)) return valueOut;

  return ZERO_BD;
}

/**
 * Update the V2LatestPrice entity from a V2TokenPrice entity,
 * and update the Token's latestUSDPrice with change validation.
 */
export async function updateLatestPrice(
  tokenPriceEntity: any,
  blockTimestamp: number,
  chainId: number,
  context: any,
): Promise<void> {
  const asset = tokenPriceEntity.asset.toLowerCase();
  const pricingAsset = tokenPriceEntity.pricingAsset.toLowerCase();
  const latestPriceId = getLatestPriceId(chainId, asset, pricingAsset);

  // Load or create V2LatestPrice
  let latestPrice = await context.V2LatestPrice.get(latestPriceId);

  if (!latestPrice) {
    latestPrice = {
      id: latestPriceId,
      asset,
      pricingAsset,
      pool_id: tokenPriceEntity.pool_id,
      price: tokenPriceEntity.price,
      block: tokenPriceEntity.block,
    };
  } else {
    latestPrice = {
      ...latestPrice,
      price: tokenPriceEntity.price,
      block: tokenPriceEntity.block,
      pool_id: tokenPriceEntity.pool_id,
    };
  }

  context.V2LatestPrice.set(latestPrice);

  // Now update the Token's latestUSDPrice
  const tokenId = makeChainId(chainId, asset);
  const token = await context.Token.get(tokenId);
  if (!token) return;

  // Compute USD price: if pricingAsset is a USD stablecoin, the price is directly USD
  // Otherwise, we need the pricingAsset's own USD price
  let newUSDPrice: BigDecimal;

  if (isUSDStable(chainId, pricingAsset)) {
    newUSDPrice = tokenPriceEntity.price;
  } else {
    // Look up the pricing asset's latestUSDPrice
    const pricingAssetTokenId = makeChainId(chainId, pricingAsset);
    const pricingAssetToken = await context.Token.get(pricingAssetTokenId);

    if (!pricingAssetToken || !pricingAssetToken.latestUSDPrice) {
      return;
    }

    newUSDPrice = tokenPriceEntity.price.times(pricingAssetToken.latestUSDPrice);
  }

  // Validate price change
  const oldPrice = token.latestUSDPrice;
  const oldTimestamp = token.latestUSDPriceTimestamp;

  if (oldPrice && oldPrice.gt(ZERO_BD)) {
    const priceChange = newUSDPrice.minus(oldPrice).div(oldPrice);
    const timeDiff = oldTimestamp ? blockTimestamp - Number(oldTimestamp) : MAX_TIME_DIFF_FOR_PRICING + 1;

    // Only update if change is within bounds OR enough time has elapsed
    if (
      priceChange.gt(MAX_POS_PRICE_CHANGE) ||
      priceChange.lt(MAX_NEG_PRICE_CHANGE)
    ) {
      // Price change is outside acceptable range
      if (timeDiff <= MAX_TIME_DIFF_FOR_PRICING) {
        // Not enough time has passed — reject the update
        return;
      }
      // Enough time has passed — allow the update despite large change
    }
  }

  // Update the token
  context.Token.set({
    ...token,
    latestUSDPrice: newUSDPrice,
    latestUSDPriceTimestamp: BigInt(blockTimestamp),
    latestPrice_id: latestPriceId,
  });
}

/**
 * Update pool liquidity, BPT price, global totals, and snapshot.
 */
export async function updatePoolLiquidity(
  poolEntityId: string,
  blockNumber: number,
  timestamp: number,
  chainId: number,
  context: any,
): Promise<void> {
  const pool = await context.V2Pool.get(poolEntityId);
  if (!pool) return;

  const poolAddress = pool.address.toLowerCase();

  // Get all pool tokens
  const poolTokens = await context.V2PoolToken.getWhere({ pool_id: { _eq: poolEntityId } });

  let totalLiquidity = ZERO_BD;
  let totalLiquiditySansBPT = ZERO_BD;

  for (const poolToken of poolTokens) {
    const tokenAddress = poolToken.address.toLowerCase();

    // Check if this token is the pool's own BPT (virtual supply pools)
    const tokenId = makeChainId(chainId, tokenAddress);
    const token = await context.Token.get(tokenId);

    const isBPT = token && token.pool_id !== undefined && token.pool_id !== null;

    const tokenValueUSD = await valueInUSD(poolToken.balance, tokenAddress, chainId, context);

    totalLiquidity = totalLiquidity.plus(tokenValueUSD);

    if (!isBPT) {
      totalLiquiditySansBPT = totalLiquiditySansBPT.plus(tokenValueUSD);
    }
  }

  // For pools with virtual supply, use totalLiquiditySansBPT as the primary liquidity
  const effectiveLiquidity = hasVirtualSupply(pool.poolType)
    ? totalLiquiditySansBPT
    : totalLiquidity;

  // Calculate old pool liquidity for global update
  const oldPoolLiquidity = pool.totalLiquidity;

  context.V2Pool.set({
    ...pool,
    totalLiquidity: effectiveLiquidity,
    totalLiquiditySansBPT,
  });

  // Update BPT price if liquidity is above minimum threshold
  if (effectiveLiquidity.gt(MIN_POOL_LIQUIDITY)) {
    await updateBptPrice(
      { ...pool, totalLiquidity: effectiveLiquidity },
      chainId,
      context,
    );
  }

  // Update V2Balancer global totalLiquidity
  const vaultId = makeChainId(chainId, V2_VAULT_ADDRESS);
  let vault = await context.V2Balancer.get(vaultId);
  if (!vault) {
    vault = defaultV2Balancer(chainId, V2_VAULT_ADDRESS);
  }

  const liquidityDelta = effectiveLiquidity.minus(oldPoolLiquidity);
  const newTotalLiquidity = vault.totalLiquidity.plus(liquidityDelta);

  context.V2Balancer.set({
    ...vault,
    totalLiquidity: newTotalLiquidity,
  });

  // Update pool snapshot
  await updateV2PoolSnapshot(
    { ...pool, totalLiquidity: effectiveLiquidity, totalLiquiditySansBPT },
    poolAddress,
    timestamp,
    chainId,
    context,
  );
}

/**
 * Update the BPT token's latestUSDPrice based on pool liquidity and total shares.
 */
export async function updateBptPrice(
  pool: any,
  chainId: number,
  context: any,
): Promise<void> {
  if (pool.totalShares.eq(ZERO_BD)) return;

  const bptPrice = pool.totalLiquidity.div(pool.totalShares);

  const tokenId = makeChainId(chainId, pool.address.toLowerCase());
  const token = await context.Token.get(tokenId);
  if (!token) return;

  context.Token.set({
    ...token,
    latestUSDPrice: bptPrice,
    pool_id: tokenId,
  });
}

/**
 * Add a historical pool liquidity record denominated in a pricing asset.
 */
export async function addHistoricalPoolLiquidityRecord(
  poolEntityId: string,
  block: bigint,
  pricingAsset: string,
  chainId: number,
  context: any,
): Promise<void> {
  const pool = await context.V2Pool.get(poolEntityId);
  if (!pool) return;

  const pricingAssetAddr = pricingAsset.toLowerCase();
  const poolAddress = pool.address.toLowerCase();

  // Calculate pool value in terms of the pricing asset
  const poolTokens = await context.V2PoolToken.getWhere({ pool_id: { _eq: poolEntityId } });

  let poolLiquidity = ZERO_BD;

  for (const poolToken of poolTokens) {
    const tokenAddress = poolToken.address.toLowerCase();

    // Skip the pool's own BPT
    const tokenId = makeChainId(chainId, tokenAddress);
    const token = await context.Token.get(tokenId);
    const isBPT = token && token.pool_id !== undefined && token.pool_id !== null;
    if (isBPT) continue;

    if (tokenAddress === pricingAssetAddr) {
      // This token IS the pricing asset — add balance directly
      poolLiquidity = poolLiquidity.plus(poolToken.balance);
    } else if (isPricingAsset(chainId, tokenAddress)) {
      // This token is a different pricing asset — convert via latestPrice
      const latestPriceId = getLatestPriceId(chainId, tokenAddress, pricingAssetAddr);
      const latestPrice = await context.V2LatestPrice.get(latestPriceId);
      if (latestPrice) {
        poolLiquidity = poolLiquidity.plus(poolToken.balance.times(latestPrice.price));
      }
    } else {
      // Non-pricing-asset token — try to find its price in terms of the pricing asset
      const latestPriceId = getLatestPriceId(chainId, tokenAddress, pricingAssetAddr);
      const latestPrice = await context.V2LatestPrice.get(latestPriceId);
      if (latestPrice) {
        poolLiquidity = poolLiquidity.plus(poolToken.balance.times(latestPrice.price));
      }
    }
  }

  const poolShareValue = pool.totalShares.gt(ZERO_BD)
    ? poolLiquidity.div(pool.totalShares)
    : ZERO_BD;

  const historicalLiquidityId = `${chainId}-${poolAddress}-${block.toString()}`;

  context.V2PoolHistoricalLiquidity.set({
    id: historicalLiquidityId,
    pool_id: poolEntityId,
    poolTotalShares: pool.totalShares,
    poolLiquidity,
    poolShareValue,
    pricingAsset: pricingAssetAddr,
    block,
  });
}

// ================================
// Internal Helpers
// ================================

async function updateV2PoolSnapshot(
  pool: any,
  poolAddress: string,
  timestamp: number,
  chainId: number,
  context: any,
): Promise<void> {
  const snapshotId = v2SnapshotId(chainId, poolAddress, timestamp);
  const dayTimestamp = timestamp - (timestamp % DAY);
  const poolEntityId = makeChainId(chainId, poolAddress);

  let snapshot = await context.V2PoolSnapshot.get(snapshotId);
  if (!snapshot) {
    snapshot = defaultV2PoolSnapshot(chainId, poolAddress, timestamp);
  }

  // Get current pool token balances
  const poolTokens = await context.V2PoolToken.getWhere({ pool_id: { _eq: poolEntityId } });
  poolTokens.sort((a: any, b: any) => (a.index ?? 0) - (b.index ?? 0));
  const amounts = poolTokens.map((pt: any) => pt.balance);

  context.V2PoolSnapshot.set({
    ...snapshot,
    pool_id: poolEntityId,
    timestamp: dayTimestamp,
    amounts,
    totalShares: pool.totalShares,
    swapVolume: pool.totalSwapVolume,
    swapFees: pool.totalSwapFee,
    protocolFee: pool.totalProtocolFee,
    liquidity: pool.totalLiquidity,
    swapsCount: pool.swapsCount,
    holdersCount: pool.holdersCount,
  });

  // Update V2Balancer snapshot
  const vaultId = makeChainId(chainId, V2_VAULT_ADDRESS);
  let vault = await context.V2Balancer.get(vaultId);
  if (!vault) {
    vault = defaultV2Balancer(chainId, V2_VAULT_ADDRESS);
  }

  const balancerSnapshotId = `${chainId}-${V2_VAULT_ADDRESS}-${dayTimestamp}`;
  let balancerSnapshot = await context.V2BalancerSnapshot.get(balancerSnapshotId);
  if (!balancerSnapshot) {
    balancerSnapshot = defaultV2BalancerSnapshot(chainId, V2_VAULT_ADDRESS, timestamp);
  }

  context.V2BalancerSnapshot.set({
    ...balancerSnapshot,
    poolCount: vault.poolCount,
    totalLiquidity: vault.totalLiquidity,
    totalSwapCount: vault.totalSwapCount,
    totalSwapVolume: vault.totalSwapVolume,
    totalSwapFee: vault.totalSwapFee,
    totalProtocolFee: vault.totalProtocolFee,
  });
}
