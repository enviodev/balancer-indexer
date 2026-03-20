import { SonicStakingContract } from "generated";
import BigDecimal from "bignumber.js";
import { ZERO_BD } from "../../utils/constants.js";
import { scaleDown } from "../../utils/math.js";
import { makeChainId } from "../../utils/entities.js";
import { getSonicStakingState } from "../../effects/sonicStaking.js";

const DAY = 24 * 60 * 60;

const SONIC_STAKING_ADDRESS = "0xe5da20f15420ad15de0fa650600afc998bbe3955";

function stakingId(chainId: number): string {
  return makeChainId(chainId, `sts-${SONIC_STAKING_ADDRESS}`);
}

function validatorEntityId(chainId: number, validatorNum: string): string {
  return makeChainId(chainId, `sts-validator-${validatorNum}`);
}

function snapshotEntityId(chainId: number, dayTs: number): string {
  return makeChainId(chainId, `sts-snap-${SONIC_STAKING_ADDRESS}-${dayTs}`);
}

function dayTimestamp(ts: number): number {
  return ts - (ts % DAY);
}

async function getOrCreateStaking(context: any, chainId: number) {
  const id = stakingId(chainId);
  let staking = await context.SonicStaking.get(id);
  if (!staking) {
    staking = {
      id,
      totalPool: ZERO_BD,
      totalDelegated: ZERO_BD,
      totalAssets: ZERO_BD,
      exchangeRate: ZERO_BD,
      totalRewardsClaimed: ZERO_BD,
      totalProtocolFee: ZERO_BD,
    };
    context.SonicStaking.set(staking);
  }
  return staking;
}

async function getOrCreateValidator(context: any, chainId: number, valId: string) {
  const id = validatorEntityId(chainId, valId);
  let validator = await context.StsValidator.get(id);
  if (!validator) {
    const staking = await getOrCreateStaking(context, chainId);
    validator = {
      id,
      sonicStaking_id: staking.id,
      amountAssetsDelegated: ZERO_BD,
    };
    context.StsValidator.set(validator);
  }
  return validator;
}

async function getOrCreateSnapshot(context: any, chainId: number, timestamp: number) {
  const dayTs = dayTimestamp(timestamp);
  const id = snapshotEntityId(chainId, dayTs);
  let snapshot = await context.SonicStakingSnapshot.get(id);
  if (!snapshot) {
    snapshot = {
      id,
      snapshotTimestamp: dayTs,
      totalPool: ZERO_BD,
      totalDelegated: ZERO_BD,
      totalAssets: ZERO_BD,
      exchangeRate: ZERO_BD,
      totalRewardsClaimed: ZERO_BD,
      totalProtocolFee: ZERO_BD,
      rewardsClaimed24h: ZERO_BD,
      protocolFee24h: ZERO_BD,
    };
    context.SonicStakingSnapshot.set(snapshot);
  }
  return snapshot;
}

/** Single RPC call to update both staking entity and snapshot */
async function updateStakingAndSnapshot(context: any, chainId: number, contractAddr: string, timestamp: number) {
  try {
    const state = await context.effect(getSonicStakingState, { address: contractAddr, chainId });
    const totalPool = scaleDown(BigInt(state.totalPool), 18);
    const totalDelegated = scaleDown(BigInt(state.totalDelegated), 18);
    const totalAssets = scaleDown(BigInt(state.totalAssets), 18);
    const exchangeRate = scaleDown(BigInt(state.rate), 18);

    const staking = await getOrCreateStaking(context, chainId);
    context.SonicStaking.set({ ...staking, totalPool, totalDelegated, totalAssets, exchangeRate });

    const snapshot = await getOrCreateSnapshot(context, chainId, timestamp);
    context.SonicStakingSnapshot.set({ ...snapshot, totalPool, totalDelegated, totalAssets, exchangeRate });
  } catch (e) {
    context.log.warn(`STS: Failed to fetch on-chain state: ${e}`);
  }
}

// ================================
// Deposited
// ================================

SonicStakingContract.Deposited.handler(async ({ event, context }) => {
  await updateStakingAndSnapshot(context, event.chainId, event.srcAddress, Number(event.block.timestamp));
});

// ================================
// Donated
// ================================

SonicStakingContract.Donated.handler(async ({ event, context }) => {
  await updateStakingAndSnapshot(context, event.chainId, event.srcAddress, Number(event.block.timestamp));
});

// ================================
// Delegated
// ================================

SonicStakingContract.Delegated.handler(async ({ event, context }) => {
  const { validatorId: valId, amountAssets } = event.params;
  const chainId = event.chainId;

  const validator = await getOrCreateValidator(context, chainId, valId.toString());
  context.StsValidator.set({
    ...validator,
    amountAssetsDelegated: validator.amountAssetsDelegated.plus(scaleDown(amountAssets, 18)),
  });

  await updateStakingAndSnapshot(context, chainId, event.srcAddress, Number(event.block.timestamp));
});

// ================================
// Undelegated
// ================================

SonicStakingContract.Undelegated.handler(async ({ event, context }) => {
  const { validatorId: valId, amountAssets } = event.params;
  const chainId = event.chainId;

  const validator = await getOrCreateValidator(context, chainId, valId.toString());
  context.StsValidator.set({
    ...validator,
    amountAssetsDelegated: validator.amountAssetsDelegated.minus(scaleDown(amountAssets, 18)),
  });

  await updateStakingAndSnapshot(context, chainId, event.srcAddress, Number(event.block.timestamp));
});

// ================================
// OperatorClawBackInitiated
// ================================

SonicStakingContract.OperatorClawBackInitiated.handler(async ({ event, context }) => {
  const { validatorId: valId, amountAssets } = event.params;
  const chainId = event.chainId;

  const validator = await getOrCreateValidator(context, chainId, valId.toString());
  context.StsValidator.set({
    ...validator,
    amountAssetsDelegated: validator.amountAssetsDelegated.minus(scaleDown(amountAssets, 18)),
  });

  await updateStakingAndSnapshot(context, chainId, event.srcAddress, Number(event.block.timestamp));
});

// ================================
// OperatorClawBackExecuted
// ================================

SonicStakingContract.OperatorClawBackExecuted.handler(async ({ event, context }) => {
  await updateStakingAndSnapshot(context, event.chainId, event.srcAddress, Number(event.block.timestamp));
});

// ================================
// RewardsClaimed
// ================================

SonicStakingContract.RewardsClaimed.handler(async ({ event, context }) => {
  const { amountClaimed, protocolFee } = event.params;
  const chainId = event.chainId;
  const ts = Number(event.block.timestamp);
  const scaledClaimed = scaleDown(amountClaimed, 18);
  const scaledFee = scaleDown(protocolFee, 18);

  // Update cumulative rewards first
  const staking = await getOrCreateStaking(context, chainId);
  context.SonicStaking.set({
    ...staking,
    totalRewardsClaimed: staking.totalRewardsClaimed.plus(scaledClaimed),
    totalProtocolFee: staking.totalProtocolFee.plus(scaledFee),
  });

  const snapshot = await getOrCreateSnapshot(context, chainId, ts);
  context.SonicStakingSnapshot.set({
    ...snapshot,
    totalRewardsClaimed: staking.totalRewardsClaimed.plus(scaledClaimed),
    totalProtocolFee: staking.totalProtocolFee.plus(scaledFee),
    rewardsClaimed24h: snapshot.rewardsClaimed24h.plus(scaledClaimed),
    protocolFee24h: snapshot.protocolFee24h.plus(scaledFee),
  });

  // Then update on-chain state (single RPC call)
  await updateStakingAndSnapshot(context, chainId, event.srcAddress, ts);
});
