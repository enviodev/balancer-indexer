import {
  VotingEscrowContract,
  GaugeController,
  OmniVotingEscrow,
  OmniVotingEscrowChild,
} from "generated";
import BigDecimal from "bignumber.js";
import { ZERO_BD, ZERO_BI } from "../../utils/constants.js";
import { scaleDown } from "../../utils/math.js";
import { makeChainId } from "../../utils/entities.js";

const LOCK_MAXTIME = 365n * 86400n; // 1 year in seconds

// ================================
// VotingEscrowContract handlers
// ================================

VotingEscrowContract.Deposit.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const userAddress = event.params.provider.toLowerCase();
  const escrowAddress = event.srcAddress.toLowerCase();

  // Ensure user exists
  const userId = makeChainId(chainId, userAddress);
  if (!(await context.User.get(userId))) {
    context.User.set({ id: userId });
  }

  // Get or create VotingEscrowLock
  const lockId = `${chainId}-${userAddress}-${escrowAddress}`;
  let lock = await context.VotingEscrowLock.get(lockId);

  const depositAmount = scaleDown(event.params.value, 18);
  const blockTimestamp = event.block.timestamp;

  if (!lock) {
    lock = {
      id: lockId,
      user_id: userId,
      votingEscrowID_id: makeChainId(chainId, escrowAddress),
      lockedBalance: ZERO_BD,
      bias: ZERO_BD,
      slope: ZERO_BD,
      timestamp: Number(blockTimestamp),
      unlockTime: 0n,
      updatedAt: Number(blockTimestamp),
    };
  }

  const newLockedBalance = lock.lockedBalance.plus(depositAmount);
  const unlockTime = event.params.locktime;

  // Calculate slope and bias
  // slope = lockedBalance / LOCK_MAXTIME
  // bias = slope * (unlockTime - blockTimestamp)
  const lockedBalanceScaledUp = BigInt(newLockedBalance.times(new BigDecimal("1e18")).integerValue().toFixed());
  const slopeBI = lockedBalanceScaledUp / LOCK_MAXTIME;
  const biasBI = slopeBI * (unlockTime - BigInt(blockTimestamp));

  context.VotingEscrowLock.set({
    ...lock,
    lockedBalance: newLockedBalance,
    unlockTime,
    updatedAt: Number(blockTimestamp),
    slope: scaleDown(slopeBI, 18),
    bias: scaleDown(biasBI, 18),
    timestamp: Number(blockTimestamp),
  });

  // Create LockSnapshot
  const snapshotId = `${chainId}-${userAddress}-${blockTimestamp}`;
  context.LockSnapshot.set({
    id: snapshotId,
    user_id: userId,
    slope: scaleDown(slopeBI, 18),
    bias: scaleDown(biasBI, 18),
    timestamp: Number(blockTimestamp),
  });
});

VotingEscrowContract.Withdraw.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const userAddress = event.params.provider.toLowerCase();
  const escrowAddress = event.srcAddress.toLowerCase();

  // Ensure user exists
  const userId = makeChainId(chainId, userAddress);
  if (!(await context.User.get(userId))) {
    context.User.set({ id: userId });
  }

  const lockId = `${chainId}-${userAddress}-${escrowAddress}`;
  const lock = await context.VotingEscrowLock.get(lockId);
  if (!lock) return;

  context.VotingEscrowLock.set({
    ...lock,
    lockedBalance: ZERO_BD,
    bias: ZERO_BD,
    slope: ZERO_BD,
    updatedAt: Number(event.block.timestamp),
  });
});

VotingEscrowContract.Supply.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const escrowAddress = event.srcAddress.toLowerCase();
  const escrowId = makeChainId(chainId, escrowAddress);

  let escrow = await context.VotingEscrow.get(escrowId);
  if (!escrow) {
    escrow = { id: escrowId, stakedSupply: undefined };
  }

  context.VotingEscrow.set({
    ...escrow,
    stakedSupply: scaleDown(event.params.supply, 18),
  });
});

// ================================
// GaugeController handlers
// ================================

GaugeController.AddType.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const typeId = `${chainId}-${event.params.type_id}`;

  context.GaugeType.set({
    id: typeId,
    name: event.params.name,
  });
});

GaugeController.NewGauge.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const gaugeAddress = event.params.addr.toLowerCase();
  const gaugeType = event.params.gauge_type;
  const gaugeId = `${chainId}-${gaugeAddress}-${gaugeType}`;
  const typeId = `${chainId}-${gaugeType}`;

  // Look up existing gauge entities
  const liquidityGaugeId = makeChainId(chainId, gaugeAddress);
  const liquidityGauge = await context.LiquidityGauge.get(liquidityGaugeId);
  const rootGauge = await context.RootGauge.get(liquidityGaugeId);
  const singleRecipientGauge = await context.SingleRecipientGauge.get(liquidityGaugeId);

  // Create Gauge entity
  context.Gauge.set({
    id: gaugeId,
    address: gaugeAddress,
    type_id: typeId,
    addedTimestamp: Number(event.block.timestamp),
    liquidityGauge_id: liquidityGauge ? liquidityGaugeId : undefined,
    rootGauge_id: rootGauge ? liquidityGaugeId : undefined,
  });

  // Update references on sub-gauge entities
  if (rootGauge) {
    context.RootGauge.set({ ...rootGauge, gauge_id: gaugeId });
  }

  if (singleRecipientGauge) {
    context.SingleRecipientGauge.set({ ...singleRecipientGauge, gauge_id: gaugeId });
  }

  if (liquidityGauge) {
    context.LiquidityGauge.set({
      ...liquidityGauge,
      gauge_id: gaugeId,
      isPreferentialGauge: true,
    });

    // Update GaugePool's preferentialGauge
    if (liquidityGauge.poolAddress) {
      const gaugePoolId = makeChainId(chainId, liquidityGauge.poolAddress);
      const pool = await context.GaugePool.get(gaugePoolId);
      if (pool) {
        // Unset previous preferential gauge
        const prevPrefId = pool.preferentialGauge_id;
        if (prevPrefId && prevPrefId !== liquidityGaugeId) {
          const prevPref = await context.LiquidityGauge.get(prevPrefId);
          if (prevPref) {
            context.LiquidityGauge.set({ ...prevPref, isPreferentialGauge: false });
          }
        }
        context.GaugePool.set({ ...pool, preferentialGauge_id: liquidityGaugeId });
      }
    }
  }
});

GaugeController.VoteForGauge.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const userAddress = event.params.user.toLowerCase();
  const gaugeAddress = event.params.gauge_addr.toLowerCase();

  // Ensure user exists
  const userId = makeChainId(chainId, userAddress);
  if (!(await context.User.get(userId))) {
    context.User.set({ id: userId });
  }

  const voteId = `${chainId}-${userAddress}-${gaugeAddress}`;
  let vote = await context.GaugeVote.get(voteId);

  // For the gauge_id, we need the Gauge entity ID which is `${chainId}-${gaugeAddress}-${gaugeType}`
  // We don't know the gaugeType from this event, so we use a simplified lookup
  // The gauge_id will be set to a placeholder; ideally we'd look up the Gauge entity
  const gaugeEntityId = makeChainId(chainId, gaugeAddress);

  if (!vote) {
    vote = {
      id: voteId,
      user_id: userId,
      gauge_id: gaugeEntityId, // simplified — may need proper Gauge entity lookup
      weight: undefined,
      timestamp: undefined,
    };
  }

  context.GaugeVote.set({
    ...vote,
    weight: scaleDown(event.params.weight, 18),
    timestamp: event.params.time,
  });
});

// ================================
// OmniVotingEscrow handlers
// ================================

OmniVotingEscrow.UserBalToChain.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const userAddress = event.params.localUser.toLowerCase();
  const contractAddress = event.srcAddress.toLowerCase();
  const dstChainId = Number(event.params.dstChainId);

  // Ensure user exists
  const userId = makeChainId(chainId, userAddress);
  if (!(await context.User.get(userId))) {
    context.User.set({ id: userId });
  }

  const lockId = `${chainId}-${userAddress}-${contractAddress}-${dstChainId}`;

  // Tuple fields: [bias, slope, ts, blk] — access as array
  const userPoint = event.params.newUserPoint;
  const bias = userPoint[0]; // int128
  const slope = userPoint[1]; // int128

  context.OmniVotingEscrowLock.set({
    id: lockId,
    localUser_id: userId,
    remoteUser: event.params.remoteUser.toLowerCase(),
    dstChainId,
    bias: scaleDown(bias < 0n ? -bias : bias, 18),
    slope: scaleDown(slope < 0n ? -slope : slope, 18),
    timestamp: Number(userPoint[2]),
    // Hardcoded mainnet VE address
    votingEscrowID_id: `${chainId}-0xc128a9954e6c874ea3d62ce62b468ba073093f25`,
  });
});

// ================================
// OmniVotingEscrowChild handlers
// ================================

OmniVotingEscrowChild.UserBalFromChain.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const userAddress = event.params.user.toLowerCase();
  const escrowAddress = event.srcAddress.toLowerCase();

  // Ensure user exists
  const userId = makeChainId(chainId, userAddress);
  if (!(await context.User.get(userId))) {
    context.User.set({ id: userId });
  }

  // Access tuple fields
  const userPoint = event.params.userPoint;
  const bias = userPoint[0]; // int128
  const slope = userPoint[1]; // int128

  // Ensure VotingEscrow entity exists
  const escrowId = makeChainId(chainId, escrowAddress);
  let escrow = await context.VotingEscrow.get(escrowId);
  if (!escrow) {
    context.VotingEscrow.set({ id: escrowId, stakedSupply: undefined });
  }

  const lockId = `${chainId}-${userAddress}-${escrowAddress}`;
  const existingLock = await context.VotingEscrowLock.get(lockId);

  const absBias = bias < 0n ? -bias : bias;
  const absSlope = slope < 0n ? -slope : slope;
  const lockedBalanceBI = absSlope * LOCK_MAXTIME;
  const ts = Number(userPoint[2]);

  // Calculate unlockTime: ts + bias / slope (if slope > 0)
  let unlockTime = existingLock ? existingLock.unlockTime : BigInt(ts);
  if (absSlope > 0n) {
    unlockTime = BigInt(ts) + absBias / absSlope;
  }

  context.VotingEscrowLock.set({
    id: lockId,
    user_id: userId,
    votingEscrowID_id: escrowId,
    lockedBalance: scaleDown(lockedBalanceBI, 18),
    slope: scaleDown(absSlope, 18),
    bias: scaleDown(absBias, 18),
    timestamp: ts,
    unlockTime,
    updatedAt: Number(event.block.timestamp),
  });
});
