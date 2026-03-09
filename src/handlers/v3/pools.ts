import {
  V3WeightedPoolFactory,
  V3WeightedPoolV2Factory,
  V3StablePoolFactory,
  V3StablePoolV2Factory,
  V3StablePoolV3Factory,
  V3Gyro2CLPPoolFactory,
  V3GyroECLPPoolFactory,
  V3QuantAMMWeightedPoolFactory,
  V3LBPoolFactory,
  V3LBPoolV2Factory,
  V3LBPoolV3Factory,
  V3FixedPriceLBPoolFactory,
  V3ReClammPoolFactory,
  V3ReClammPoolV2Factory,
  BigDecimal,
  type V3Factory,
  type V3PoolTypeInfo,
  type V3WeightedParams,
  type V3StableParams,
  type V3Gyro2Params,
  type V3GyroEParams,
  type V3LBPParams,
  type V3FixedLBPParams,
  type V3ReClammParams,
} from "generated";
import { ZERO_BD } from "../../utils/constants.js";
import { scaleDown } from "../../utils/math.js";
import { makeChainId } from "../../utils/entities.js";
import {
  getWeightedWeights,
  getStableAmp,
  getGyro2Params,
  getGyroEParams,
  getLBPParams,
  getLBPV3Params,
  getFixedLBPParams,
  getReClammParams,
} from "../../effects/v3Pool.js";

// Helper: ensure factory exists
function ensureFactory(
  context: any,
  chainId: number,
  factoryAddress: string,
  poolType: string,
  version: number
): string {
  const factoryId = makeChainId(chainId, factoryAddress);
  const factory: V3Factory = {
    id: factoryId,
    address: factoryAddress,
    type: poolType as any,
    version,
  };
  context.V3Factory.set(factory);
  return factoryId;
}

// Helper: create pool type info
function createPoolTypeInfo(
  context: any,
  chainId: number,
  poolAddress: string,
  factoryId: string,
  overrides: Partial<V3PoolTypeInfo> = {}
): void {
  const info: V3PoolTypeInfo = {
    id: makeChainId(chainId, poolAddress),
    address: poolAddress,
    factory_id: factoryId,
    weightedParams_id: undefined,
    stableParams_id: undefined,
    stableSurgeParams_id: undefined,
    gyro2Params_id: undefined,
    gyroEParams_id: undefined,
    quantAMMWeightedParams_id: undefined,
    lbpParams_id: undefined,
    fixedLBPParams_id: undefined,
    reClammParams_id: undefined,
    ...overrides,
  };
  context.V3PoolTypeInfo.set(info);
}

// ===== Weighted Pools =====

V3WeightedPoolFactory.PoolCreated.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const poolAddress = event.params.pool;
  const factoryId = ensureFactory(context, chainId, event.srcAddress, "Weighted", 1);

  const weightsRaw = await context.effect(getWeightedWeights, { address: poolAddress, chainId });
  const paramsId = makeChainId(chainId, poolAddress);
  const params: V3WeightedParams = {
    id: paramsId,
    weights: weightsRaw.map((w: string) => scaleDown(BigInt(w), 18)),
  };
  context.V3WeightedParams.set(params);
  createPoolTypeInfo(context, chainId, poolAddress, factoryId, { weightedParams_id: paramsId });
});

V3WeightedPoolV2Factory.PoolCreated.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const poolAddress = event.params.pool;
  const factoryId = ensureFactory(context, chainId, event.srcAddress, "Weighted", 2);

  const weightsRaw = await context.effect(getWeightedWeights, { address: poolAddress, chainId });
  const paramsId = makeChainId(chainId, poolAddress);
  const params: V3WeightedParams = {
    id: paramsId,
    weights: weightsRaw.map((w: string) => scaleDown(BigInt(w), 18)),
  };
  context.V3WeightedParams.set(params);
  createPoolTypeInfo(context, chainId, poolAddress, factoryId, { weightedParams_id: paramsId });
});

// ===== Stable Pools =====

async function handleStablePool(event: any, context: any, version: number) {
  const chainId = event.chainId;
  const poolAddress = event.params.pool;
  const factoryId = ensureFactory(context, chainId, event.srcAddress, "Stable", version);

  const ampRaw = await context.effect(getStableAmp, { address: poolAddress, chainId });
  const paramsId = makeChainId(chainId, poolAddress);
  const params: V3StableParams = {
    id: paramsId,
    amp: ampRaw ? BigInt(ampRaw) : 0n,
  };
  context.V3StableParams.set(params);
  createPoolTypeInfo(context, chainId, poolAddress, factoryId, { stableParams_id: paramsId });
}

V3StablePoolFactory.PoolCreated.handler(async ({ event, context }) => {
  await handleStablePool(event, context, 1);
});

V3StablePoolV2Factory.PoolCreated.handler(async ({ event, context }) => {
  await handleStablePool(event, context, 2);
});

V3StablePoolV3Factory.PoolCreated.handler(async ({ event, context }) => {
  await handleStablePool(event, context, 3);
});

// ===== Gyro2 Pools =====

V3Gyro2CLPPoolFactory.PoolCreated.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const poolAddress = event.params.pool;
  const factoryId = ensureFactory(context, chainId, event.srcAddress, "Gyro2", 1);

  const data = await context.effect(getGyro2Params, { address: poolAddress, chainId });
  const paramsId = makeChainId(chainId, poolAddress);
  const params: V3Gyro2Params = {
    id: paramsId,
    sqrtAlpha: data ? scaleDown(BigInt(data.sqrtAlpha), 18) : ZERO_BD,
    sqrtBeta: data ? scaleDown(BigInt(data.sqrtBeta), 18) : ZERO_BD,
  };
  context.V3Gyro2Params.set(params);
  createPoolTypeInfo(context, chainId, poolAddress, factoryId, { gyro2Params_id: paramsId });
});

// ===== GyroE Pools =====

V3GyroECLPPoolFactory.PoolCreated.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const poolAddress = event.params.pool;
  const factoryId = ensureFactory(context, chainId, event.srcAddress, "GyroE", 1);

  const data = await context.effect(getGyroEParams, { address: poolAddress, chainId });
  const paramsId = makeChainId(chainId, poolAddress);

  if (data) {
    const params: V3GyroEParams = {
      id: paramsId,
      alpha: scaleDown(BigInt(data.paramsAlpha), 18),
      beta: scaleDown(BigInt(data.paramsBeta), 18),
      c: scaleDown(BigInt(data.paramsC), 18),
      s: scaleDown(BigInt(data.paramsS), 18),
      lambda: scaleDown(BigInt(data.paramsLambda), 18),
      tauAlphaX: scaleDown(BigInt(data.tauAlphaX), 38),
      tauAlphaY: scaleDown(BigInt(data.tauAlphaY), 38),
      tauBetaX: scaleDown(BigInt(data.tauBetaX), 38),
      tauBetaY: scaleDown(BigInt(data.tauBetaY), 38),
      u: scaleDown(BigInt(data.u), 38),
      v: scaleDown(BigInt(data.v), 38),
      w: scaleDown(BigInt(data.w), 38),
      z: scaleDown(BigInt(data.z), 38),
      dSq: scaleDown(BigInt(data.dSq), 38),
    };
    context.V3GyroEParams.set(params);
  } else {
    context.V3GyroEParams.set({
      id: paramsId, alpha: ZERO_BD, beta: ZERO_BD, c: ZERO_BD, s: ZERO_BD, lambda: ZERO_BD,
      tauAlphaX: ZERO_BD, tauAlphaY: ZERO_BD, tauBetaX: ZERO_BD, tauBetaY: ZERO_BD,
      u: ZERO_BD, v: ZERO_BD, w: ZERO_BD, z: ZERO_BD, dSq: ZERO_BD,
    });
  }
  createPoolTypeInfo(context, chainId, poolAddress, factoryId, { gyroEParams_id: paramsId });
});

// ===== QuantAMM Pools =====

V3QuantAMMWeightedPoolFactory.PoolCreated.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const poolAddress = event.params.pool;
  const factoryId = ensureFactory(context, chainId, event.srcAddress, "QuantAMMWeighted", 1);

  // QuantAMM params require many RPC calls — store with minimal data for now
  // Full QuantAMM param fetching would be added with a dedicated effect
  const paramsId = makeChainId(chainId, poolAddress);
  context.V3QuantAMMWeightedParams.set({
    id: paramsId,
    oracleStalenessThreshold: 0n,
    poolRegistry: 0n,
    lambda: [],
    epsilonMax: 0n,
    absoluteWeightGuardRail: 0n,
    maxTradeSizeRatio: 0n,
    updateInterval: 0n,
    weightsAtLastUpdateInterval: [],
    weightBlockMultipliers: [],
    lastUpdateIntervalTime: 0n,
    lastInterpolationTimePossible: 0n,
    runner: "",
    rule: "",
    gradientIntermediates: [],
    movingAverageIntermediates: [],
  });
  createPoolTypeInfo(context, chainId, poolAddress, factoryId, { quantAMMWeightedParams_id: paramsId });
});

// ===== LBP Pools =====

async function handleLBPool(event: any, context: any, version: number) {
  const chainId = event.chainId;
  const poolAddress = event.params.pool;
  const factoryId = ensureFactory(context, chainId, event.srcAddress, "LBP", version);

  const data = version === 3
    ? await context.effect(getLBPV3Params, { address: poolAddress, chainId })
    : await context.effect(getLBPParams, { address: poolAddress, chainId });

  const paramsId = makeChainId(chainId, poolAddress);
  const params: V3LBPParams = {
    id: paramsId,
    owner: data?.owner ?? "",
    projectToken: data?.projectToken ?? "",
    reserveToken: data?.reserveToken ?? "",
    projectTokenStartWeight: data ? BigInt(data.projectTokenStartWeight) : 0n,
    projectTokenEndWeight: data ? BigInt(data.projectTokenEndWeight) : 0n,
    reserveTokenStartWeight: data ? BigInt(data.reserveTokenStartWeight) : 0n,
    reserveTokenEndWeight: data ? BigInt(data.reserveTokenEndWeight) : 0n,
    startTime: data ? BigInt(data.startTime) : 0n,
    endTime: data ? BigInt(data.endTime) : 0n,
    isProjectTokenSwapInBlocked: data?.isProjectTokenSwapInBlocked ?? false,
    reserveTokenVirtualBalance: data ? BigInt(data.reserveTokenVirtualBalance) : 0n,
  };
  context.V3LBPParams.set(params);
  createPoolTypeInfo(context, chainId, poolAddress, factoryId, { lbpParams_id: paramsId });
}

V3LBPoolFactory.PoolCreated.handler(async ({ event, context }) => {
  await handleLBPool(event, context, 1);
});

V3LBPoolV2Factory.PoolCreated.handler(async ({ event, context }) => {
  await handleLBPool(event, context, 2);
});

V3LBPoolV3Factory.PoolCreated.handler(async ({ event, context }) => {
  await handleLBPool(event, context, 3);
});

// ===== Fixed Price LBP =====

V3FixedPriceLBPoolFactory.PoolCreated.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const poolAddress = event.params.pool;
  const factoryId = ensureFactory(context, chainId, event.srcAddress, "FixedLBP", 1);

  const data = await context.effect(getFixedLBPParams, { address: poolAddress, chainId });
  const paramsId = makeChainId(chainId, poolAddress);
  const params: V3FixedLBPParams = {
    id: paramsId,
    owner: data?.owner ?? "",
    projectToken: data?.projectToken ?? "",
    reserveToken: data?.reserveToken ?? "",
    startTime: data ? BigInt(data.startTime) : 0n,
    endTime: data ? BigInt(data.endTime) : 0n,
    isProjectTokenSwapInBlocked: data?.isProjectTokenSwapInBlocked ?? false,
    projectTokenRate: data ? BigInt(data.projectTokenRate) : 0n,
  };
  context.V3FixedLBPParams.set(params);
  createPoolTypeInfo(context, chainId, poolAddress, factoryId, { fixedLBPParams_id: paramsId });
});

// ===== ReClamm Pools =====

V3ReClammPoolFactory.PoolCreated.contractRegister(({ event, context }) => {
  context.addV3ReClammPool(event.params.pool);
});

V3ReClammPoolFactory.PoolCreated.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const poolAddress = event.params.pool;
  const factoryId = ensureFactory(context, chainId, event.srcAddress, "ReClamm", 1);

  const data = await context.effect(getReClammParams, { address: poolAddress, chainId });
  const paramsId = makeChainId(chainId, poolAddress);
  const params: V3ReClammParams = {
    id: paramsId,
    lastTimestamp: data ? BigInt(data.lastTimestamp) : 0n,
    lastVirtualBalances: data ? data.lastVirtualBalances.map((v: string) => BigInt(v)) : [],
    centerednessMargin: data ? BigInt(data.centerednessMargin) : 0n,
    dailyPriceShiftBase: data ? BigInt(data.dailyPriceShiftBase) : 0n,
    dailyPriceShiftExponent: data ? BigInt(data.dailyPriceShiftExponent) : 0n,
    currentFourthRootPriceRatio: data ? BigInt(data.currentFourthRootPriceRatio) : 0n,
    startFourthRootPriceRatio: data ? BigInt(data.startFourthRootPriceRatio) : 0n,
    endFourthRootPriceRatio: data ? BigInt(data.endFourthRootPriceRatio) : 0n,
    priceRatioUpdateStartTime: data ? BigInt(data.priceRatioUpdateStartTime) : 0n,
    priceRatioUpdateEndTime: data ? BigInt(data.priceRatioUpdateEndTime) : 0n,
  };
  context.V3ReClammParams.set(params);
  createPoolTypeInfo(context, chainId, poolAddress, factoryId, { reClammParams_id: paramsId });
});

V3ReClammPoolV2Factory.PoolCreated.contractRegister(({ event, context }) => {
  context.addV3ReClammPool(event.params.pool);
});

V3ReClammPoolV2Factory.PoolCreated.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const poolAddress = event.params.pool;
  const factoryId = ensureFactory(context, chainId, event.srcAddress, "ReClamm", 2);

  const data = await context.effect(getReClammParams, { address: poolAddress, chainId });
  const paramsId = makeChainId(chainId, poolAddress);
  const params: V3ReClammParams = {
    id: paramsId,
    lastTimestamp: data ? BigInt(data.lastTimestamp) : 0n,
    lastVirtualBalances: data ? data.lastVirtualBalances.map((v: string) => BigInt(v)) : [],
    centerednessMargin: data ? BigInt(data.centerednessMargin) : 0n,
    dailyPriceShiftBase: data ? BigInt(data.dailyPriceShiftBase) : 0n,
    dailyPriceShiftExponent: data ? BigInt(data.dailyPriceShiftExponent) : 0n,
    currentFourthRootPriceRatio: data ? BigInt(data.currentFourthRootPriceRatio) : 0n,
    startFourthRootPriceRatio: data ? BigInt(data.startFourthRootPriceRatio) : 0n,
    endFourthRootPriceRatio: data ? BigInt(data.endFourthRootPriceRatio) : 0n,
    priceRatioUpdateStartTime: data ? BigInt(data.priceRatioUpdateStartTime) : 0n,
    priceRatioUpdateEndTime: data ? BigInt(data.priceRatioUpdateEndTime) : 0n,
  };
  context.V3ReClammParams.set(params);
  createPoolTypeInfo(context, chainId, poolAddress, factoryId, { reClammParams_id: paramsId });
});
