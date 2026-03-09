import {
  GaugeLiquidityGauge,
  GaugeRewardsOnlyGauge,
  GaugeRootGauge,
  GaugeSingleRecipientGauge,
  GaugeChildChainStreamer,
  GaugeInjectorContract,
  GaugeAuthorizerAdaptor,
} from "generated";
import BigDecimal from "bignumber.js";
import { ZERO_BD, ZERO_ADDRESS } from "../../utils/constants.js";
import { scaleDown } from "../../utils/math.js";
import { makeChainId } from "../../utils/entities.js";
import { setRewardData } from "../../utils/gauges/rewards.js";
import { getRewardReceiver } from "../../effects/gauge.js";

// ================================
// Helper: Handle gauge Transfer (shared by LiquidityGauge and RewardsOnlyGauge)
// ================================

async function handleGaugeTransfer(
  event: any,
  context: any,
) {
  const chainId = event.chainId;
  const gaugeAddress = event.srcAddress.toLowerCase();
  const gaugeId = makeChainId(chainId, gaugeAddress);
  const fromAddress = event.params.from.toLowerCase();
  const toAddress = event.params.to.toLowerCase();
  const value = scaleDown(event.params.value, 18);

  const gauge = await context.LiquidityGauge.get(gaugeId);
  if (!gauge) return;

  const isMint = fromAddress === ZERO_ADDRESS;
  const isBurn = toAddress === ZERO_ADDRESS;

  // Get or create GaugeShares for from/to
  const fromShareId = `${chainId}-${fromAddress}-${gaugeAddress}`;
  const toShareId = `${chainId}-${toAddress}-${gaugeAddress}`;

  let shareFrom = await context.GaugeShare.get(fromShareId);
  let shareTo = await context.GaugeShare.get(toShareId);

  if (!shareFrom) {
    const fromUserId = makeChainId(chainId, fromAddress);
    if (!(await context.User.get(fromUserId))) {
      context.User.set({ id: fromUserId });
    }
    shareFrom = {
      id: fromShareId,
      user_id: fromUserId,
      gauge_id: gaugeId,
      balance: ZERO_BD,
    };
  }

  if (!shareTo) {
    const toUserId = makeChainId(chainId, toAddress);
    if (!(await context.User.get(toUserId))) {
      context.User.set({ id: toUserId });
    }
    shareTo = {
      id: toShareId,
      user_id: toUserId,
      gauge_id: gaugeId,
      balance: ZERO_BD,
    };
  }

  let updatedGauge = { ...gauge };

  if (isMint) {
    context.GaugeShare.set({ ...shareTo, balance: shareTo.balance.plus(value) });
    updatedGauge.totalSupply = gauge.totalSupply.plus(value);
  } else if (isBurn) {
    context.GaugeShare.set({ ...shareFrom, balance: shareFrom.balance.minus(value) });
    updatedGauge.totalSupply = gauge.totalSupply.minus(value);
  } else {
    context.GaugeShare.set({ ...shareTo, balance: shareTo.balance.plus(value) });
    context.GaugeShare.set({ ...shareFrom, balance: shareFrom.balance.minus(value) });
  }

  context.LiquidityGauge.set(updatedGauge);

  // Update reward data for all reward tokens on this gauge
  const rewardTokensList = updatedGauge.rewardTokensList ?? [];
  for (const tokenAddress of rewardTokensList) {
    await setRewardData(gaugeAddress, tokenAddress, chainId, context);
  }
}

// ================================
// GaugeLiquidityGauge handlers
// ================================

GaugeLiquidityGauge.GaugeLiquidityGaugeTransfer.handler(async ({ event, context }) => {
  await handleGaugeTransfer(event, context);
});

GaugeLiquidityGauge.RelativeWeightCapChanged.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const gaugeAddress = event.srcAddress.toLowerCase();
  const gaugeId = makeChainId(chainId, gaugeAddress);
  const gauge = await context.LiquidityGauge.get(gaugeId);
  if (!gauge) return;

  context.LiquidityGauge.set({
    ...gauge,
    relativeWeightCap: scaleDown(event.params.new_relative_weight_cap, 18),
  });
});

// ================================
// GaugeRewardsOnlyGauge handlers
// ================================

GaugeRewardsOnlyGauge.GaugeRewardsOnlyTransfer.handler(async ({ event, context }) => {
  await handleGaugeTransfer(event, context);
});

// ================================
// GaugeRootGauge handlers
// ================================

GaugeRootGauge.RootGaugeRelativeWeightCapChanged.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const gaugeAddress = event.srcAddress.toLowerCase();
  const gaugeId = makeChainId(chainId, gaugeAddress);
  const gauge = await context.RootGauge.get(gaugeId);
  if (!gauge) return;

  context.RootGauge.set({
    ...gauge,
    relativeWeightCap: scaleDown(event.params.new_relative_weight_cap, 18),
  });
});

// ================================
// GaugeSingleRecipientGauge handlers
// ================================

GaugeSingleRecipientGauge.SingleRecipientRelativeWeightCapChanged.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const gaugeAddress = event.srcAddress.toLowerCase();
  const gaugeId = makeChainId(chainId, gaugeAddress);
  const gauge = await context.SingleRecipientGauge.get(gaugeId);
  if (!gauge) return;

  context.SingleRecipientGauge.set({
    ...gauge,
    relativeWeightCap: scaleDown(event.params.new_relative_weight_cap, 18),
  });
});

// ================================
// GaugeChildChainStreamer handlers
// ================================

GaugeChildChainStreamer.RewardDurationUpdated.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const streamerAddress = event.srcAddress.toLowerCase();
  const rewardTokenAddress = event.params.reward_token.toLowerCase();

  // The streamer's reward_receiver() returns the gauge address
  const gaugeAddress = await context.effect(getRewardReceiver, {
    address: streamerAddress,
    chainId,
  });

  if (gaugeAddress) {
    await setRewardData(gaugeAddress.toLowerCase(), rewardTokenAddress, chainId, context);
  }
});

// ================================
// GaugeInjectorContract handlers
// ================================

GaugeInjectorContract.EmissionsInjection.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const gaugeAddress = event.params.gauge.toLowerCase();
  const tokenAddress = event.params.token.toLowerCase();

  await setRewardData(gaugeAddress, tokenAddress, chainId, context);
});

// ================================
// GaugeAuthorizerAdaptor handlers
// ================================

GaugeAuthorizerAdaptor.ActionPerformed.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const data = event.params.data as string;

  // Check for add_reward selector: 0xe8de0d4d
  if (!data || data.length < 74) return;
  const selector = data.slice(0, 10);
  if (selector !== "0xe8de0d4d") return;

  // Parse calldata: add_reward(address token, address distributor)
  // The first argument (token address) is at bytes 16-36 of the data param
  // data layout: 0x + 8 chars selector + 64 chars arg1 (address padded) + 64 chars arg2
  const tokenAddress = ("0x" + data.slice(34, 74)).toLowerCase();
  const gaugeAddress = event.params.target.toLowerCase();

  await setRewardData(gaugeAddress, tokenAddress, chainId, context);
});
