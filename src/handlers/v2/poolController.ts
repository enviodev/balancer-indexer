import { V2Pool } from "generated";
import BigDecimal from "bignumber.js";
import { ZERO_BD, ZERO_BI, ZERO_ADDRESS, V2_VAULT_ADDRESS, ONE_BD } from "../../utils/constants.js";
import { scaleDown, tokenToDecimal } from "../../utils/math.js";
import { makeChainId, defaultUser } from "../../utils/entities.js";
import { defaultV2PoolShare, v2PoolShareId, v2PoolTokenId, defaultV2Balancer } from "../../utils/v2/entities.js";
import { valueInUSD } from "../../utils/v2/pricing.js";

const BPT_DECIMALS = 18;

// =============================================================================
// Transfer — BPT share tracking
// =============================================================================

V2Pool.Transfer.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const poolAddress = event.srcAddress;
  const poolId = makeChainId(chainId, poolAddress);

  const isMint = event.params.from === ZERO_ADDRESS;
  const isBurn = event.params.to === ZERO_ADDRESS;

  const pool = await context.V2Pool.get(poolId);
  if (!pool) return;

  const amount = tokenToDecimal(event.params.value, BPT_DECIMALS);

  // Get or create shares for from/to
  const fromShareId = v2PoolShareId(chainId, poolAddress, event.params.from);
  const toShareId = v2PoolShareId(chainId, poolAddress, event.params.to);

  let poolShareFrom = await context.V2PoolShare.get(fromShareId);
  let poolShareTo = await context.V2PoolShare.get(toShareId);

  const prevFromBalance = poolShareFrom?.balance ?? ZERO_BD;
  const prevToBalance = poolShareTo?.balance ?? ZERO_BD;

  if (!poolShareFrom) {
    const userId = makeChainId(chainId, event.params.from);
    const user = await context.User.get(userId);
    if (!user) context.User.set(defaultUser(chainId, event.params.from));
    poolShareFrom = defaultV2PoolShare(chainId, poolAddress, event.params.from);
  }

  if (!poolShareTo) {
    const userId = makeChainId(chainId, event.params.to);
    const user = await context.User.get(userId);
    if (!user) context.User.set(defaultUser(chainId, event.params.to));
    poolShareTo = defaultV2PoolShare(chainId, poolAddress, event.params.to);
  }

  let updatedPool = { ...pool };

  if (isMint) {
    context.V2PoolShare.set({ ...poolShareTo, balance: poolShareTo.balance.plus(amount) });
    updatedPool.totalShares = pool.totalShares.plus(amount);

    // Check if mint is to protocol fee collector (protocol fee payment)
    const vaultId = makeChainId(chainId, V2_VAULT_ADDRESS);
    let vault = await context.V2Balancer.get(vaultId);
    if (vault?.protocolFeesCollector && event.params.to.toLowerCase() === vault.protocolFeesCollector.toLowerCase()) {
      const totalProtocolFeePaidInBPT = (updatedPool.totalProtocolFeePaidInBPT ?? ZERO_BD).plus(amount);
      updatedPool.totalProtocolFeePaidInBPT = totalProtocolFeePaidInBPT;

      const protocolFeeUSD = await valueInUSD(amount, poolAddress, chainId, context);
      const totalProtocolFee = (updatedPool.totalProtocolFee ?? ZERO_BD).plus(protocolFeeUSD);
      updatedPool.totalProtocolFee = totalProtocolFee;

      // Update vault-level totalProtocolFee
      const vaultProtocolFee = (vault.totalProtocolFee ?? ZERO_BD).plus(protocolFeeUSD);
      context.V2Balancer.set({
        ...vault,
        totalProtocolFee: vaultProtocolFee,
      });
    }
  } else if (isBurn) {
    context.V2PoolShare.set({ ...poolShareFrom, balance: poolShareFrom.balance.minus(amount) });
    updatedPool.totalShares = pool.totalShares.minus(amount);
  } else {
    context.V2PoolShare.set({ ...poolShareTo, balance: poolShareTo.balance.plus(amount) });
    context.V2PoolShare.set({ ...poolShareFrom, balance: poolShareFrom.balance.minus(amount) });
  }

  // Track holders count
  const newToBalance = isBurn ? prevToBalance : poolShareTo.balance.plus(amount);
  const newFromBalance = isMint ? prevFromBalance : poolShareFrom.balance.minus(amount);

  if (!newToBalance.eq(ZERO_BD) && prevToBalance.eq(ZERO_BD)) {
    updatedPool.holdersCount = updatedPool.holdersCount + 1n;
  }

  if (newFromBalance.eq(ZERO_BD) && !prevFromBalance.eq(ZERO_BD)) {
    updatedPool.holdersCount = updatedPool.holdersCount - 1n;
  }

  context.V2Pool.set(updatedPool);
});

// =============================================================================
// SwapFeePercentageChanged
// =============================================================================

V2Pool.SwapFeePercentageChanged.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const poolId = makeChainId(chainId, event.srcAddress);
  const pool = await context.V2Pool.get(poolId);
  if (!pool) return;

  const newSwapFee = scaleDown(event.params.swapFeePercentage, 18);

  context.V2Pool.set({
    ...pool,
    swapFee: newSwapFee,
  });

  // Create SwapFeeUpdate entity
  const swapFeeUpdateId = `${chainId}_${event.block.number}_${event.logIndex}`;
  context.V2SwapFeeUpdate.set({
    id: swapFeeUpdateId,
    pool_id: poolId,
    scheduledTimestamp: event.block.timestamp,
    startTimestamp: BigInt(event.block.timestamp),
    endTimestamp: BigInt(event.block.timestamp),
    startSwapFeePercentage: newSwapFee,
    endSwapFeePercentage: newSwapFee,
  });
});

// =============================================================================
// PausedStateChanged
// =============================================================================

V2Pool.PausedStateChanged.handler(async ({ event, context }) => {
  const poolId = makeChainId(event.chainId, event.srcAddress);
  const pool = await context.V2Pool.get(poolId);
  if (!pool) return;

  const isPaused = event.params.paused;
  // Compute swapEnabled using curation signal logic:
  // swapEnabled = !isPaused && swapEnabledCurationSignal && swapEnabledInternal
  const curationSignal = pool.swapEnabledCurationSignal ?? true;
  const internalEnabled = pool.swapEnabledInternal ?? true;
  const swapEnabled = !isPaused && curationSignal && internalEnabled;

  context.V2Pool.set({
    ...pool,
    isPaused,
    swapEnabled,
  });
});

// =============================================================================
// RecoveryModeStateChanged
// =============================================================================

V2Pool.RecoveryModeStateChanged.handler(async ({ event, context }) => {
  const poolId = makeChainId(event.chainId, event.srcAddress);
  const pool = await context.V2Pool.get(poolId);
  if (!pool) return;

  const update: any = {
    ...pool,
    isInRecoveryMode: event.params.enabled,
  };

  // Zero protocol fee caches when entering recovery mode
  if (event.params.enabled) {
    update.protocolSwapFeeCache = ZERO_BD;
    update.protocolYieldFeeCache = ZERO_BD;
    update.protocolAumFeeCache = ZERO_BD;
  }

  context.V2Pool.set(update);
});

// =============================================================================
// AmpUpdateStarted
// =============================================================================

V2Pool.AmpUpdateStarted.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const poolAddress = event.srcAddress;
  const poolId = makeChainId(chainId, poolAddress);
  const pool = await context.V2Pool.get(poolId);
  if (!pool) return;

  const ampUpdateId = `${poolId}-${event.block.timestamp}`;

  context.V2AmpUpdate.set({
    id: ampUpdateId,
    pool_id: poolId,
    scheduledTimestamp: event.block.timestamp,
    startTimestamp: event.params.startTime,
    endTimestamp: event.params.endTime,
    startAmp: event.params.startValue,
    endAmp: event.params.endValue,
  });

  // Calculate current amp factor at this timestamp
  const currentAmp = calculateAmp(
    event.params.startValue,
    event.params.endValue,
    event.params.startTime,
    event.params.endTime,
    BigInt(event.block.timestamp),
  );

  context.V2Pool.set({
    ...pool,
    latestAmpUpdate_id: ampUpdateId,
    amp: currentAmp,
  });
});

// =============================================================================
// AmpUpdateStopped
// =============================================================================

V2Pool.AmpUpdateStopped.handler(async ({ event, context }) => {
  const poolId = makeChainId(event.chainId, event.srcAddress);
  const pool = await context.V2Pool.get(poolId);
  if (!pool) return;

  context.V2Pool.set({
    ...pool,
    amp: event.params.currentValue,
  });
});

// =============================================================================
// SwapEnabledSet
// =============================================================================

V2Pool.SwapEnabledSet.handler(async ({ event, context }) => {
  const poolId = makeChainId(event.chainId, event.srcAddress);
  const pool = await context.V2Pool.get(poolId);
  if (!pool) return;

  context.V2Pool.set({
    ...pool,
    swapEnabledInternal: event.params.swapEnabled,
    swapEnabled: event.params.swapEnabled,
  });
});

// =============================================================================
// GradualWeightUpdateScheduled
// =============================================================================

V2Pool.GradualWeightUpdateScheduled.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const poolAddress = event.srcAddress;
  const poolId = makeChainId(chainId, poolAddress);
  const pool = await context.V2Pool.get(poolId);
  if (!pool) return;

  const weightUpdateId = `${poolId}-${event.block.timestamp}`;

  context.V2GradualWeightUpdate.set({
    id: weightUpdateId,
    pool_id: poolId,
    scheduledTimestamp: event.block.timestamp,
    startTimestamp: event.params.startTime,
    endTimestamp: event.params.endTime,
    startWeights: event.params.startWeights,
    endWeights: event.params.endWeights,
  });
});

// =============================================================================
// OracleEnabledChanged
// =============================================================================

V2Pool.OracleEnabledChanged.handler(async ({ event, context }) => {
  const poolId = makeChainId(event.chainId, event.srcAddress);
  const pool = await context.V2Pool.get(poolId);
  if (!pool) return;

  context.V2Pool.set({
    ...pool,
    oracleEnabled: event.params.enabled,
  });
});

// =============================================================================
// TargetsSet — Linear pool targets
// =============================================================================

V2Pool.TargetsSet.handler(async ({ event, context }) => {
  const poolId = makeChainId(event.chainId, event.srcAddress);
  const pool = await context.V2Pool.get(poolId);
  if (!pool) return;

  context.V2Pool.set({
    ...pool,
    lowerTarget: scaleDown(event.params.lowerTarget, 18),
    upperTarget: scaleDown(event.params.upperTarget, 18),
  });
});

// =============================================================================
// PausedLocally — Gyro pool pause
// =============================================================================

V2Pool.PausedLocally.handler(async ({ event, context }) => {
  const poolId = makeChainId(event.chainId, event.srcAddress);
  const pool = await context.V2Pool.get(poolId);
  if (!pool) return;

  context.V2Pool.set({
    ...pool,
    swapEnabledInternal: false,
    swapEnabled: false,
  });
});

// =============================================================================
// UnpausedLocally — Gyro pool unpause
// =============================================================================

V2Pool.UnpausedLocally.handler(async ({ event, context }) => {
  const poolId = makeChainId(event.chainId, event.srcAddress);
  const pool = await context.V2Pool.get(poolId);
  if (!pool) return;

  context.V2Pool.set({
    ...pool,
    swapEnabledInternal: true,
    swapEnabled: true,
  });
});

// =============================================================================
// ProtocolFeePercentageCacheUpdated
// =============================================================================

V2Pool.ProtocolFeePercentageCacheUpdated.handler(async ({ event, context }) => {
  const poolId = makeChainId(event.chainId, event.srcAddress);
  const pool = await context.V2Pool.get(poolId);
  if (!pool) return;

  const feeType = event.params.feeType;
  const feeValue = scaleDown(event.params.protocolSwapFeePercentage, 18);

  if (feeType === 0n) {
    // Swap fee
    context.V2Pool.set({ ...pool, protocolSwapFeeCache: feeValue });
  } else if (feeType === 1n) {
    // Yield fee
    context.V2Pool.set({ ...pool, protocolYieldFeeCache: feeValue });
  } else if (feeType === 2n) {
    // AUM fee
    context.V2Pool.set({ ...pool, protocolAumFeeCache: feeValue });
  }
});

// =============================================================================
// Helpers
// =============================================================================

const AMP_PRECISION = 1000n;

/**
 * Calculate the current amp value by interpolating between start and end values.
 * Mirrors the subgraph's calculateAmp logic.
 */
export function calculateAmp(
  startValue: bigint,
  endValue: bigint,
  startTime: bigint,
  endTime: bigint,
  blockTimestamp: bigint,
): bigint {
  let value: bigint;

  if (blockTimestamp < endTime) {
    const duration = endTime - startTime;
    const elapsed = blockTimestamp - startTime;
    if (endValue > startValue) {
      value = startValue + ((endValue - startValue) * elapsed) / duration;
    } else {
      value = startValue - ((startValue - endValue) * elapsed) / duration;
    }
  } else {
    value = endValue;
  }

  return value / AMP_PRECISION;
}

// =============================================================================
// PriceRateProviderSet — MetaStable pools
// =============================================================================

V2Pool.PriceRateProviderSet.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const poolAddress = event.srcAddress;
  const poolId = makeChainId(chainId, poolAddress);
  const pool = await context.V2Pool.get(poolId);
  if (!pool) return;

  const tokenAddress = event.params.token.toLowerCase();
  const providerAddress = event.params.provider.toLowerCase();
  const cacheDuration = Number(event.params.cacheDuration);

  const providerId = v2PoolTokenId(chainId, poolAddress, tokenAddress);
  const tokenId = makeChainId(chainId, tokenAddress);

  context.V2PriceRateProvider.set({
    id: providerId,
    pool_id: poolId,
    token_id: tokenId,
    address: providerAddress,
    rate: ONE_BD,
    lastCached: event.block.timestamp,
    cacheDuration,
    cacheExpiry: event.block.timestamp + cacheDuration,
  });
});

// =============================================================================
// PriceRateCacheUpdated — MetaStable pools
// =============================================================================

V2Pool.PriceRateCacheUpdated.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const poolAddress = event.srcAddress;
  const poolId = makeChainId(chainId, poolAddress);
  const tokenAddress = event.params.token.toLowerCase();

  const providerId = v2PoolTokenId(chainId, poolAddress, tokenAddress);
  const provider = await context.V2PriceRateProvider.get(providerId);
  if (!provider) return;

  const rate = scaleDown(event.params.rate, 18);
  context.V2PriceRateProvider.set({
    ...provider,
    rate,
    lastCached: event.block.timestamp,
    cacheExpiry: event.block.timestamp + (provider.cacheDuration ?? 0),
  });

  // Also update the pool token's priceRate
  const poolToken1 = await context.V2PoolToken.get(providerId);
  if (poolToken1) {
    context.V2PoolToken.set({
      ...poolToken1,
      oldPriceRate: poolToken1.priceRate,
      priceRate: rate,
    });
  }
});

// =============================================================================
// TokenRateProviderSet — ComposableStable pools (uses tokenIndex instead of address)
// =============================================================================

V2Pool.TokenRateProviderSet.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const poolAddress = event.srcAddress;
  const poolId = makeChainId(chainId, poolAddress);
  const pool = await context.V2Pool.get(poolId);
  if (!pool) return;

  const tokenIndex = Number(event.params.tokenIndex);
  const tokensList = pool.tokensList ?? [];
  if (tokenIndex >= tokensList.length) return;

  const tokenAddress = tokensList[tokenIndex]!.toLowerCase();
  const providerAddress = event.params.provider.toLowerCase();
  const cacheDuration = Number(event.params.cacheDuration);

  const providerId = v2PoolTokenId(chainId, poolAddress, tokenAddress);
  const tokenId = makeChainId(chainId, tokenAddress);

  context.V2PriceRateProvider.set({
    id: providerId,
    pool_id: poolId,
    token_id: tokenId,
    address: providerAddress,
    rate: ONE_BD,
    lastCached: event.block.timestamp,
    cacheDuration,
    cacheExpiry: event.block.timestamp + cacheDuration,
  });
});

// =============================================================================
// TokenRateCacheUpdated — ComposableStable pools (uses tokenIndex instead of address)
// =============================================================================

V2Pool.TokenRateCacheUpdated.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const poolAddress = event.srcAddress;
  const poolId = makeChainId(chainId, poolAddress);
  const pool = await context.V2Pool.get(poolId);
  if (!pool) return;

  const tokenIndex = Number(event.params.tokenIndex);
  const tokensList = pool.tokensList ?? [];
  if (tokenIndex >= tokensList.length) return;

  const tokenAddress = tokensList[tokenIndex]!.toLowerCase();
  const providerId = v2PoolTokenId(chainId, poolAddress, tokenAddress);
  const provider = await context.V2PriceRateProvider.get(providerId);
  if (!provider) return;

  const rate = scaleDown(event.params.rate, 18);
  context.V2PriceRateProvider.set({
    ...provider,
    rate,
    lastCached: event.block.timestamp,
    cacheExpiry: event.block.timestamp + (provider.cacheDuration ?? 0),
  });

  // Also update the pool token's priceRate
  const poolToken = await context.V2PoolToken.get(providerId);
  if (poolToken) {
    context.V2PoolToken.set({
      ...poolToken,
      oldPriceRate: poolToken.priceRate,
      priceRate: rate,
    });
  }
});

// =============================================================================
// MustAllowlistLPsSet — Managed pools
// =============================================================================

V2Pool.MustAllowlistLPsSet.handler(async ({ event, context }) => {
  const poolId = makeChainId(event.chainId, event.srcAddress);
  const pool = await context.V2Pool.get(poolId);
  if (!pool) return;

  context.V2Pool.set({
    ...pool,
    mustAllowlistLPs: event.params.mustAllowlistLPs,
  });
});

// =============================================================================
// JoinExitEnabledSet — Managed pools
// =============================================================================

V2Pool.JoinExitEnabledSet.handler(async ({ event, context }) => {
  const poolId = makeChainId(event.chainId, event.srcAddress);
  const pool = await context.V2Pool.get(poolId);
  if (!pool) return;

  context.V2Pool.set({
    ...pool,
    joinExitEnabled: event.params.joinExitEnabled,
  });
});

// =============================================================================
// CircuitBreakerSet — Managed pools
// =============================================================================

V2Pool.CircuitBreakerSet.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const poolAddress = event.srcAddress;
  const poolId = makeChainId(chainId, poolAddress);
  const pool = await context.V2Pool.get(poolId);
  if (!pool) return;

  const tokenAddress = event.params.token.toLowerCase();
  const cbId = v2PoolTokenId(chainId, poolAddress, tokenAddress);

  context.V2CircuitBreaker.set({
    id: cbId,
    pool_id: poolId,
    token_id: makeChainId(chainId, tokenAddress),
    bptPrice: scaleDown(event.params.bptPrice, 18),
    lowerBoundPercentage: scaleDown(event.params.lowerBoundPercentage, 18),
    upperBoundPercentage: scaleDown(event.params.upperBoundPercentage, 18),
  });

  // Link circuit breaker to pool token
  const poolTokenId = v2PoolTokenId(chainId, poolAddress, tokenAddress);
  const poolToken2 = await context.V2PoolToken.get(poolTokenId);
  if (poolToken2) {
    context.V2PoolToken.set({
      ...poolToken2,
      circuitBreaker_id: cbId,
    });
  }
});

// =============================================================================
// TokenAdded — Managed pools (dynamic token management)
// =============================================================================

V2Pool.TokenAdded.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const poolAddress = event.srcAddress;
  const poolId = makeChainId(chainId, poolAddress);
  const pool = await context.V2Pool.get(poolId);
  if (!pool) return;

  const tokenAddress = event.params.token.toLowerCase();
  const tokensList = [...(pool.tokensList ?? [])];
  if (!tokensList.includes(tokenAddress)) {
    tokensList.push(tokenAddress);
  }

  context.V2Pool.set({
    ...pool,
    tokensList,
  });
});

// =============================================================================
// TokenRemoved — Managed pools (dynamic token management)
// =============================================================================

V2Pool.TokenRemoved.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const poolAddress = event.srcAddress;
  const poolId = makeChainId(chainId, poolAddress);
  const pool = await context.V2Pool.get(poolId);
  if (!pool) return;

  const tokenAddress = event.params.token.toLowerCase();
  const tokensList = (pool.tokensList ?? []).filter(
    (t: string) => t.toLowerCase() !== tokenAddress,
  );

  context.V2Pool.set({
    ...pool,
    tokensList,
  });
});

// =============================================================================
// ManagementAumFeeCollected — Managed pools
// =============================================================================

V2Pool.ManagementAumFeeCollected.handler(async ({ event, context }) => {
  const poolId = makeChainId(event.chainId, event.srcAddress);
  const pool = await context.V2Pool.get(poolId);
  if (!pool) return;

  const bptCollected = scaleDown(event.params.bptAmount, BPT_DECIMALS);
  const totalCollected = (pool.totalAumFeeCollectedInBPT ?? ZERO_BD).plus(bptCollected);

  context.V2Pool.set({
    ...pool,
    totalAumFeeCollectedInBPT: totalCollected,
  });
});

// =============================================================================
// ManagementFeePercentageChanged — Managed pools
// =============================================================================

V2Pool.ManagementFeePercentageChanged.handler(async ({ event, context }) => {
  const poolId = makeChainId(event.chainId, event.srcAddress);
  const pool = await context.V2Pool.get(poolId);
  if (!pool) return;

  context.V2Pool.set({
    ...pool,
    managementFee: scaleDown(event.params.managementFeePercentage, 18),
  });
});

// =============================================================================
// ManagementAumFeePercentageChanged — Managed pools
// =============================================================================

V2Pool.ManagementAumFeePercentageChanged.handler(async ({ event, context }) => {
  const poolId = makeChainId(event.chainId, event.srcAddress);
  const pool = await context.V2Pool.get(poolId);
  if (!pool) return;

  context.V2Pool.set({
    ...pool,
    managementAumFee: scaleDown(event.params.managementAumFeePercentage, 18),
  });
});

// =============================================================================
// GradualSwapFeeUpdateScheduled — LBP / Managed pools
// =============================================================================

V2Pool.GradualSwapFeeUpdateScheduled.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const poolId = makeChainId(chainId, event.srcAddress);
  const pool = await context.V2Pool.get(poolId);
  if (!pool) return;

  const startSwapFee = scaleDown(event.params.startSwapFeePercentage, 18);
  const endSwapFee = scaleDown(event.params.endSwapFeePercentage, 18);

  const swapFeeUpdateId = `${chainId}_${event.block.number}_${event.logIndex}`;
  context.V2SwapFeeUpdate.set({
    id: swapFeeUpdateId,
    pool_id: poolId,
    scheduledTimestamp: event.block.timestamp,
    startTimestamp: BigInt(event.params.startTime.toString()),
    endTimestamp: BigInt(event.params.endTime.toString()),
    startSwapFeePercentage: startSwapFee,
    endSwapFeePercentage: endSwapFee,
  });

  // Also update the pool's current swap fee
  context.V2Pool.set({
    ...pool,
    swapFee: startSwapFee,
  });
});

// =============================================================================
// ParametersSet — FX pools (alpha, beta, delta, epsilon, lambda)
// =============================================================================

V2Pool.ParametersSet.handler(async ({ event, context }) => {
  const poolId = makeChainId(event.chainId, event.srcAddress);
  const pool = await context.V2Pool.get(poolId);
  if (!pool) return;

  context.V2Pool.set({
    ...pool,
    alpha: scaleDown(event.params.alpha, 18),
    beta: scaleDown(event.params.beta, 18),
    delta: scaleDown(event.params.delta, 18),
    epsilon: scaleDown(event.params.epsilon, 18),
    lambda: scaleDown(event.params.lambda, 18),
  });
});
