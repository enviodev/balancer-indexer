import { V2Pool } from "generated";
import BigDecimal from "bignumber.js";
import { ZERO_BD, ZERO_BI, ZERO_ADDRESS } from "../../utils/constants.js";
import { scaleDown, tokenToDecimal } from "../../utils/math.js";
import { makeChainId, defaultUser } from "../../utils/entities.js";
import { defaultV2PoolShare, v2PoolShareId } from "../../utils/v2/entities.js";

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
  const poolId = makeChainId(event.chainId, event.srcAddress);
  const pool = await context.V2Pool.get(poolId);
  if (!pool) return;

  context.V2Pool.set({
    ...pool,
    swapFee: scaleDown(event.params.swapFeePercentage, 18),
  });
});

// =============================================================================
// PausedStateChanged
// =============================================================================

V2Pool.PausedStateChanged.handler(async ({ event, context }) => {
  const poolId = makeChainId(event.chainId, event.srcAddress);
  const pool = await context.V2Pool.get(poolId);
  if (!pool) return;

  context.V2Pool.set({
    ...pool,
    isPaused: event.params.paused,
    swapEnabled: !event.params.paused,
  });
});

// =============================================================================
// RecoveryModeStateChanged
// =============================================================================

V2Pool.RecoveryModeStateChanged.handler(async ({ event, context }) => {
  const poolId = makeChainId(event.chainId, event.srcAddress);
  const pool = await context.V2Pool.get(poolId);
  if (!pool) return;

  context.V2Pool.set({
    ...pool,
    isInRecoveryMode: event.params.enabled,
  });
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

  context.V2Pool.set({
    ...pool,
    latestAmpUpdate_id: ampUpdateId,
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
