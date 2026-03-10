import { createEffect, S } from "envio";
import { parseAbi } from "viem";
import { getEffectClient } from "./rpc.js";

const WEIGHTED_ABI = parseAbi([
  "function getNormalizedWeights() view returns (uint256[])",
]);

const STABLE_ABI = parseAbi([
  "function getAmplificationParameter() view returns (uint256 value, bool isUpdating, uint256 precision)",
]);

const GYRO2_ABI = parseAbi([
  "function getGyro2CLPPoolImmutableData() view returns ((uint256 sqrtAlpha, uint256 sqrtBeta))",
]);

const GYRO_E_ABI = parseAbi([
  "function getGyroECLPPoolImmutableData() view returns ((uint256 paramsAlpha, uint256 paramsBeta, uint256 paramsC, uint256 paramsS, uint256 paramsLambda, int256 tauAlphaX, int256 tauAlphaY, int256 tauBetaX, int256 tauBetaY, int256 u, int256 v, int256 w, int256 z, int256 dSq))",
]);

const LBP_ABI = parseAbi([
  "function getLBPoolImmutableData() view returns ((address[] tokens, uint256 projectTokenIndex, uint256 reserveTokenIndex, uint256 startTime, uint256 endTime, uint256[] startWeights, uint256[] endWeights, bool isProjectTokenSwapInBlocked))",
  "function owner() view returns (address)",
]);

const LBP_V3_ABI = parseAbi([
  "function getLBPoolImmutableData() view returns ((address[] tokens, uint256 projectTokenIndex, uint256 reserveTokenIndex, uint256 startTime, uint256 endTime, uint256[] startWeights, uint256[] endWeights, bool isProjectTokenSwapInBlocked, uint256 reserveTokenVirtualBalance))",
  "function owner() view returns (address)",
]);

const FIXED_LBP_ABI = parseAbi([
  "function getFixedPriceLBPoolImmutableData() view returns ((address[] tokens, uint256 projectTokenIndex, uint256 reserveTokenIndex, uint256 startTime, uint256 endTime, uint256 projectTokenRate))",
  "function owner() view returns (address)",
  "function isProjectTokenSwapInBlocked() view returns (bool)",
]);

const RECLAMM_ABI = parseAbi([
  "function getReClammPoolDynamicData() view returns ((uint32 lastTimestamp, uint256[] lastVirtualBalances, uint256 centerednessMargin, uint256 dailyPriceShiftBase, uint256 currentFourthRootPriceRatio, uint256 startFourthRootPriceRatio, uint256 endFourthRootPriceRatio, uint256 priceRatioUpdateStartTime, uint256 priceRatioUpdateEndTime))",
  "function getDailyPriceShiftExponent() view returns (uint256)",
]);

const QUANTAMM_ABI = parseAbi([
  "function getQuantAMMWeightedPoolImmutableData() view returns ((uint256 absoluteWeightGuardRail, uint256 maxTradeSizeRatio, uint64 oracleStalenessThreshold, uint64 updateInterval, int256[] lambda, int256 epsilonMax, address poolRegistry))",
  "function getQuantAMMWeightedPoolDynamicData() view returns ((int256[8] firstFourWeightsAndMultipliers, int256[8] secondFourWeightsAndMultipliers, uint40 lastInteropTime, uint40 lastUpdateTime))",
  "function updateWeightRunner() view returns (address)",
]);

const QUANTAMM_RUNNER_ABI = parseAbi([
  "function getPoolRule(address pool) view returns (address)",
]);

const STABLE_SURGE_ABI = parseAbi([
  "function getMaxSurgeFeePercentage(address pool) view returns (uint256)",
  "function getSurgeThresholdPercentage(address pool) view returns (uint256)",
]);

// Weighted pool weights
export const getWeightedWeights = createEffect(
  {
    name: "getWeightedWeights",
    input: S.schema({ address: S.string, chainId: S.number }),
    output: S.array(S.string),
    cache: true,
    rateLimit: false,
  },
  async ({ input }) => {
    const client = getEffectClient(input.chainId);
    try {
      const weights = await client.readContract({
        address: input.address as `0x${string}`,
        abi: WEIGHTED_ABI,
        functionName: "getNormalizedWeights",
      });
      return (weights as bigint[]).map(w => w.toString());
    } catch {
      return [];
    }
  }
);

// Stable pool amp
export const getStableAmp = createEffect(
  {
    name: "getStableAmp",
    input: S.schema({ address: S.string, chainId: S.number }),
    output: S.union([S.string, null]),
    cache: true,
    rateLimit: false,
  },
  async ({ input }) => {
    const client = getEffectClient(input.chainId);
    try {
      const result = await client.readContract({
        address: input.address as `0x${string}`,
        abi: STABLE_ABI,
        functionName: "getAmplificationParameter",
      });
      const [value, , precision] = result as [bigint, boolean, bigint];
      return (value / precision).toString();
    } catch {
      return null;
    }
  }
);

// Gyro2 params
export const getGyro2Params = createEffect(
  {
    name: "getGyro2Params",
    input: S.schema({ address: S.string, chainId: S.number }),
    output: S.union([
      S.schema({ sqrtAlpha: S.string, sqrtBeta: S.string }),
      null,
    ]),
    cache: true,
    rateLimit: false,
  },
  async ({ input }) => {
    const client = getEffectClient(input.chainId);
    try {
      const result = await client.readContract({
        address: input.address as `0x${string}`,
        abi: GYRO2_ABI,
        functionName: "getGyro2CLPPoolImmutableData",
      }) as { sqrtAlpha: bigint; sqrtBeta: bigint };
      return {
        sqrtAlpha: result.sqrtAlpha.toString(),
        sqrtBeta: result.sqrtBeta.toString(),
      };
    } catch {
      return null;
    }
  }
);

// GyroE params
export const getGyroEParams = createEffect(
  {
    name: "getGyroEParams",
    input: S.schema({ address: S.string, chainId: S.number }),
    output: S.union([
      S.schema({
        paramsAlpha: S.string, paramsBeta: S.string, paramsC: S.string,
        paramsS: S.string, paramsLambda: S.string,
        tauAlphaX: S.string, tauAlphaY: S.string,
        tauBetaX: S.string, tauBetaY: S.string,
        u: S.string, v: S.string, w: S.string, z: S.string, dSq: S.string,
      }),
      null,
    ]),
    cache: true,
    rateLimit: false,
  },
  async ({ input }) => {
    const client = getEffectClient(input.chainId);
    try {
      const r = await client.readContract({
        address: input.address as `0x${string}`,
        abi: GYRO_E_ABI,
        functionName: "getGyroECLPPoolImmutableData",
      }) as any;
      return {
        paramsAlpha: r.paramsAlpha.toString(), paramsBeta: r.paramsBeta.toString(),
        paramsC: r.paramsC.toString(), paramsS: r.paramsS.toString(),
        paramsLambda: r.paramsLambda.toString(),
        tauAlphaX: r.tauAlphaX.toString(), tauAlphaY: r.tauAlphaY.toString(),
        tauBetaX: r.tauBetaX.toString(), tauBetaY: r.tauBetaY.toString(),
        u: r.u.toString(), v: r.v.toString(), w: r.w.toString(),
        z: r.z.toString(), dSq: r.dSq.toString(),
      };
    } catch {
      return null;
    }
  }
);

// LBP params
export const getLBPParams = createEffect(
  {
    name: "getLBPParams",
    input: S.schema({ address: S.string, chainId: S.number }),
    output: S.union([
      S.schema({
        owner: S.string, projectToken: S.string, reserveToken: S.string,
        startTime: S.string, endTime: S.string,
        projectTokenStartWeight: S.string, projectTokenEndWeight: S.string,
        reserveTokenStartWeight: S.string, reserveTokenEndWeight: S.string,
        isProjectTokenSwapInBlocked: S.boolean,
        reserveTokenVirtualBalance: S.string,
      }),
      null,
    ]),
    cache: true,
    rateLimit: false,
  },
  async ({ input }) => {
    const client = getEffectClient(input.chainId);
    const addr = input.address as `0x${string}`;
    try {
      const owner = await client.readContract({ address: addr, abi: LBP_ABI, functionName: "owner" }) as string;
      const data = await client.readContract({ address: addr, abi: LBP_ABI, functionName: "getLBPoolImmutableData" }) as any;
      const pIdx = Number(data.projectTokenIndex);
      const rIdx = Number(data.reserveTokenIndex);
      return {
        owner,
        projectToken: data.tokens[pIdx],
        reserveToken: data.tokens[rIdx],
        startTime: data.startTime.toString(),
        endTime: data.endTime.toString(),
        projectTokenStartWeight: data.startWeights[pIdx].toString(),
        projectTokenEndWeight: data.endWeights[pIdx].toString(),
        reserveTokenStartWeight: data.startWeights[rIdx].toString(),
        reserveTokenEndWeight: data.endWeights[rIdx].toString(),
        isProjectTokenSwapInBlocked: data.isProjectTokenSwapInBlocked,
        reserveTokenVirtualBalance: "0",
      };
    } catch {
      return null;
    }
  }
);

// LBP V3 params (includes reserveTokenVirtualBalance)
export const getLBPV3Params = createEffect(
  {
    name: "getLBPV3Params",
    input: S.schema({ address: S.string, chainId: S.number }),
    output: S.union([
      S.schema({
        owner: S.string, projectToken: S.string, reserveToken: S.string,
        startTime: S.string, endTime: S.string,
        projectTokenStartWeight: S.string, projectTokenEndWeight: S.string,
        reserveTokenStartWeight: S.string, reserveTokenEndWeight: S.string,
        isProjectTokenSwapInBlocked: S.boolean,
        reserveTokenVirtualBalance: S.string,
      }),
      null,
    ]),
    cache: true,
    rateLimit: false,
  },
  async ({ input }) => {
    const client = getEffectClient(input.chainId);
    const addr = input.address as `0x${string}`;
    try {
      const owner = await client.readContract({ address: addr, abi: LBP_V3_ABI, functionName: "owner" }) as string;
      const data = await client.readContract({ address: addr, abi: LBP_V3_ABI, functionName: "getLBPoolImmutableData" }) as any;
      const pIdx = Number(data.projectTokenIndex);
      const rIdx = Number(data.reserveTokenIndex);
      return {
        owner,
        projectToken: data.tokens[pIdx],
        reserveToken: data.tokens[rIdx],
        startTime: data.startTime.toString(),
        endTime: data.endTime.toString(),
        projectTokenStartWeight: data.startWeights[pIdx].toString(),
        projectTokenEndWeight: data.endWeights[pIdx].toString(),
        reserveTokenStartWeight: data.startWeights[rIdx].toString(),
        reserveTokenEndWeight: data.endWeights[rIdx].toString(),
        isProjectTokenSwapInBlocked: data.isProjectTokenSwapInBlocked,
        reserveTokenVirtualBalance: data.reserveTokenVirtualBalance.toString(),
      };
    } catch {
      return null;
    }
  }
);

// Fixed price LBP params
export const getFixedLBPParams = createEffect(
  {
    name: "getFixedLBPParams",
    input: S.schema({ address: S.string, chainId: S.number }),
    output: S.union([
      S.schema({
        owner: S.string, projectToken: S.string, reserveToken: S.string,
        startTime: S.string, endTime: S.string,
        isProjectTokenSwapInBlocked: S.boolean,
        projectTokenRate: S.string,
      }),
      null,
    ]),
    cache: true,
    rateLimit: false,
  },
  async ({ input }) => {
    const client = getEffectClient(input.chainId);
    const addr = input.address as `0x${string}`;
    try {
      const owner = await client.readContract({ address: addr, abi: FIXED_LBP_ABI, functionName: "owner" }) as string;
      const blocked = await client.readContract({ address: addr, abi: FIXED_LBP_ABI, functionName: "isProjectTokenSwapInBlocked" }) as boolean;
      const data = await client.readContract({ address: addr, abi: FIXED_LBP_ABI, functionName: "getFixedPriceLBPoolImmutableData" }) as any;
      const pIdx = Number(data.projectTokenIndex);
      const rIdx = Number(data.reserveTokenIndex);
      return {
        owner,
        projectToken: data.tokens[pIdx],
        reserveToken: data.tokens[rIdx],
        startTime: data.startTime.toString(),
        endTime: data.endTime.toString(),
        isProjectTokenSwapInBlocked: blocked,
        projectTokenRate: data.projectTokenRate.toString(),
      };
    } catch {
      return null;
    }
  }
);

// ReClamm pool params
export const getReClammParams = createEffect(
  {
    name: "getReClammParams",
    input: S.schema({ address: S.string, chainId: S.number }),
    output: S.union([
      S.schema({
        lastTimestamp: S.string,
        lastVirtualBalances: S.array(S.string),
        centerednessMargin: S.string,
        dailyPriceShiftBase: S.string,
        dailyPriceShiftExponent: S.string,
        currentFourthRootPriceRatio: S.string,
        startFourthRootPriceRatio: S.string,
        endFourthRootPriceRatio: S.string,
        priceRatioUpdateStartTime: S.string,
        priceRatioUpdateEndTime: S.string,
      }),
      null,
    ]),
    cache: true,
    rateLimit: false,
  },
  async ({ input }) => {
    const client = getEffectClient(input.chainId);
    const addr = input.address as `0x${string}`;
    try {
      const data = await client.readContract({ address: addr, abi: RECLAMM_ABI, functionName: "getReClammPoolDynamicData" }) as any;
      const exponent = await client.readContract({ address: addr, abi: RECLAMM_ABI, functionName: "getDailyPriceShiftExponent" }) as bigint;
      return {
        lastTimestamp: data.lastTimestamp.toString(),
        lastVirtualBalances: (data.lastVirtualBalances as bigint[]).map(v => v.toString()),
        centerednessMargin: data.centerednessMargin.toString(),
        dailyPriceShiftBase: data.dailyPriceShiftBase.toString(),
        dailyPriceShiftExponent: exponent.toString(),
        currentFourthRootPriceRatio: data.currentFourthRootPriceRatio.toString(),
        startFourthRootPriceRatio: data.startFourthRootPriceRatio.toString(),
        endFourthRootPriceRatio: data.endFourthRootPriceRatio.toString(),
        priceRatioUpdateStartTime: data.priceRatioUpdateStartTime.toString(),
        priceRatioUpdateEndTime: data.priceRatioUpdateEndTime.toString(),
      };
    } catch {
      return null;
    }
  }
);

// QuantAMM Weighted pool params
export const getQuantAMMParams = createEffect(
  {
    name: "getQuantAMMParams",
    input: S.schema({ address: S.string, chainId: S.number }),
    output: S.union([
      S.schema({
        absoluteWeightGuardRail: S.string,
        maxTradeSizeRatio: S.string,
        oracleStalenessThreshold: S.string,
        updateInterval: S.string,
        lambda: S.array(S.string),
        epsilonMax: S.string,
        poolRegistry: S.string,
        weightsAtLastUpdateInterval: S.array(S.string),
        weightBlockMultipliers: S.array(S.string),
        lastInterpolationTimePossible: S.string,
        lastUpdateIntervalTime: S.string,
        runner: S.string,
        rule: S.string,
      }),
      null,
    ]),
    cache: true,
    rateLimit: false,
  },
  async ({ input }) => {
    const client = getEffectClient(input.chainId);
    const addr = input.address as `0x${string}`;
    try {
      const immutableData = await client.readContract({
        address: addr,
        abi: QUANTAMM_ABI,
        functionName: "getQuantAMMWeightedPoolImmutableData",
      }) as any;

      const dynamicData = await client.readContract({
        address: addr,
        abi: QUANTAMM_ABI,
        functionName: "getQuantAMMWeightedPoolDynamicData",
      }) as any;

      // Weights are in first 4 slots of each array, multipliers in slots 4-7
      const firstFour = dynamicData.firstFourWeightsAndMultipliers as bigint[];
      const secondFour = dynamicData.secondFourWeightsAndMultipliers as bigint[];

      const weightsAtLastUpdateInterval = [
        ...firstFour.slice(0, 4),
        ...secondFour.slice(0, 4),
      ].map(v => v.toString());

      const weightBlockMultipliers = [
        ...firstFour.slice(4, 8),
        ...secondFour.slice(4, 8),
      ].map(v => v.toString());

      // Get runner and rule addresses
      let runner = "";
      let rule = "";
      try {
        const runnerAddr = await client.readContract({
          address: addr,
          abi: QUANTAMM_ABI,
          functionName: "updateWeightRunner",
        }) as string;
        runner = runnerAddr;

        try {
          const ruleAddr = await client.readContract({
            address: runnerAddr as `0x${string}`,
            abi: QUANTAMM_RUNNER_ABI,
            functionName: "getPoolRule",
            args: [addr],
          }) as string;
          rule = ruleAddr;
        } catch { /* ignore rule fetch failure */ }
      } catch { /* ignore runner fetch failure */ }

      return {
        absoluteWeightGuardRail: immutableData.absoluteWeightGuardRail.toString(),
        maxTradeSizeRatio: immutableData.maxTradeSizeRatio.toString(),
        oracleStalenessThreshold: immutableData.oracleStalenessThreshold.toString(),
        updateInterval: immutableData.updateInterval.toString(),
        lambda: (immutableData.lambda as bigint[]).map(v => v.toString()),
        epsilonMax: immutableData.epsilonMax.toString(),
        poolRegistry: immutableData.poolRegistry.toString(),
        weightsAtLastUpdateInterval,
        weightBlockMultipliers,
        lastInterpolationTimePossible: dynamicData.lastInteropTime.toString(),
        lastUpdateIntervalTime: dynamicData.lastUpdateTime.toString(),
        runner,
        rule,
      };
    } catch {
      return null;
    }
  }
);

// Stable Surge hook params
export const getStableSurgeParams = createEffect(
  {
    name: "getStableSurgeParams",
    input: S.schema({ poolAddress: S.string, hookAddress: S.string, chainId: S.number }),
    output: S.union([
      S.schema({
        amp: S.union([S.string, null]),
        maxSurgeFeePercentage: S.string,
        surgeThresholdPercentage: S.string,
      }),
      null,
    ]),
    cache: true,
    rateLimit: false,
  },
  async ({ input }) => {
    const client = getEffectClient(input.chainId);
    const poolAddr = input.poolAddress as `0x${string}`;
    const hookAddr = input.hookAddress as `0x${string}`;
    try {
      let amp: string | null = null;
      try {
        const ampResult = await client.readContract({ address: poolAddr, abi: STABLE_ABI, functionName: "getAmplificationParameter" });
        const [value, , precision] = ampResult as [bigint, boolean, bigint];
        amp = (value / precision).toString();
      } catch { /* ignore */ }

      const maxSurge = await client.readContract({ address: hookAddr, abi: STABLE_SURGE_ABI, functionName: "getMaxSurgeFeePercentage", args: [poolAddr] }) as bigint;
      const threshold = await client.readContract({ address: hookAddr, abi: STABLE_SURGE_ABI, functionName: "getSurgeThresholdPercentage", args: [poolAddr] }) as bigint;

      return {
        amp,
        maxSurgeFeePercentage: maxSurge.toString(),
        surgeThresholdPercentage: threshold.toString(),
      };
    } catch {
      return null;
    }
  }
);
