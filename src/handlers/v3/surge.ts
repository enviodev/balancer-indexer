import { V3StableSurgeHook, V3StableSurgeHookV2, type V3StableSurgeParams } from "generated";
import { ZERO_BD } from "../../utils/constants.js";
import { scaleDown } from "../../utils/math.js";
import { makeChainId } from "../../utils/entities.js";
import { getStableSurgeParams } from "../../effects/v3Pool.js";

async function handleStableSurgeRegistered(
  event: any,
  context: any,
  version: number
) {
  const chainId = event.chainId;
  const poolAddress = event.params.pool;
  const factoryAddress = event.params.factory;
  const hookAddress = event.srcAddress;

  // Check if pool type info already exists (skip if pool was already registered)
  const poolTypeInfoId = makeChainId(chainId, poolAddress);
  const existingInfo = await context.V3PoolTypeInfo.get(poolTypeInfoId);
  if (existingInfo) return;

  // Get surge params via effect
  const data = await context.effect(getStableSurgeParams, {
    poolAddress,
    hookAddress,
    chainId,
  });

  const paramsId = makeChainId(chainId, poolAddress);
  const params: V3StableSurgeParams = {
    id: paramsId,
    amp: data?.amp ? BigInt(data.amp) : 0n,
    maxSurgeFeePercentage: data ? scaleDown(BigInt(data.maxSurgeFeePercentage), 18) : ZERO_BD,
    surgeThresholdPercentage: data ? scaleDown(BigInt(data.surgeThresholdPercentage), 18) : ZERO_BD,
  };
  context.V3StableSurgeParams.set(params);

  // Create factory
  const factoryId = makeChainId(chainId, factoryAddress);
  context.V3Factory.set({
    id: factoryId,
    address: factoryAddress,
    type: "StableSurge",
    version,
  });

  // Create pool type info
  context.V3PoolTypeInfo.set({
    id: poolTypeInfoId,
    address: poolAddress,
    factory_id: factoryId,
    weightedParams_id: undefined,
    stableParams_id: undefined,
    stableSurgeParams_id: paramsId,
    gyro2Params_id: undefined,
    gyroEParams_id: undefined,
    quantAMMWeightedParams_id: undefined,
    lbpParams_id: undefined,
    fixedLBPParams_id: undefined,
    reClammParams_id: undefined,
  });
}

V3StableSurgeHook.StableSurgeHookRegistered.handler(async ({ event, context }) => {
  await handleStableSurgeRegistered(event, context, 1);
});

V3StableSurgeHookV2.StableSurgeHookRegistered.handler(async ({ event, context }) => {
  await handleStableSurgeRegistered(event, context, 2);
});
