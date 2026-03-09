import { createEffect, S } from "envio";
import { parseAbi } from "viem";
import { getEffectClient } from "./rpc.js";

const POOL_ABI = parseAbi([
  "function getPoolId() view returns (bytes32)",
  "function getOwner() view returns (address)",
  "function getSwapFeePercentage() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
]);

const WEIGHTED_ABI = parseAbi([
  "function getNormalizedWeights() view returns (uint256[])",
]);

const STABLE_ABI = parseAbi([
  "function getAmplificationParameter() view returns (uint256 value, bool isUpdating, uint256 precision)",
]);

const LINEAR_ABI = parseAbi([
  "function getMainIndex() view returns (uint256)",
  "function getWrappedIndex() view returns (uint256)",
  "function getTargets() view returns (uint256 lowerTarget, uint256 upperTarget)",
]);

const COMPOSABLE_STABLE_ABI = parseAbi([
  "function getAmplificationParameter() view returns (uint256 value, bool isUpdating, uint256 precision)",
  "function getActualSupply() view returns (uint256)",
]);

const GYRO2_ABI = parseAbi([
  "function getSqrtParameters() view returns (uint256[] sqrtParameters)",
]);

const GYROE_ABI = parseAbi([
  "function getECLPParams() view returns ((uint256 alpha, uint256 beta, uint256 c, uint256 s, uint256 lambda) params, (int256 tauAlpha_x, int256 tauAlpha_y, int256 tauBeta_x, int256 tauBeta_y, int256 u, int256 v, int256 w, int256 z, int256 dSq) derived)",
]);

export const getPoolId = createEffect(
  {
    name: "v2GetPoolId",
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
        abi: POOL_ABI,
        functionName: "getPoolId",
      });
      return result as string;
    } catch {
      return null;
    }
  }
);

export const getPoolOwner = createEffect(
  {
    name: "v2GetPoolOwner",
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
        abi: POOL_ABI,
        functionName: "getOwner",
      });
      return result as string;
    } catch {
      return null;
    }
  }
);

export const getSwapFeePercentage = createEffect(
  {
    name: "v2GetSwapFeePercentage",
    input: S.schema({ address: S.string, chainId: S.number }),
    output: S.string,
    cache: true,
    rateLimit: false,
  },
  async ({ input }) => {
    const client = getEffectClient(input.chainId);
    try {
      const result = await client.readContract({
        address: input.address as `0x${string}`,
        abi: POOL_ABI,
        functionName: "getSwapFeePercentage",
      });
      return (result as bigint).toString();
    } catch {
      return "0";
    }
  }
);

export const getWeights = createEffect(
  {
    name: "v2GetWeights",
    input: S.schema({ address: S.string, chainId: S.number }),
    output: S.array(S.string),
    cache: true,
    rateLimit: false,
  },
  async ({ input }) => {
    const client = getEffectClient(input.chainId);
    try {
      const result = await client.readContract({
        address: input.address as `0x${string}`,
        abi: WEIGHTED_ABI,
        functionName: "getNormalizedWeights",
      });
      return (result as bigint[]).map(w => w.toString());
    } catch {
      return [];
    }
  }
);

export const getAmp = createEffect(
  {
    name: "v2GetAmp",
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

export const getLinearTargets = createEffect(
  {
    name: "v2GetLinearTargets",
    input: S.schema({ address: S.string, chainId: S.number }),
    output: S.union([
      S.schema({ mainIndex: S.number, wrappedIndex: S.number, lowerTarget: S.string, upperTarget: S.string }),
      null,
    ]),
    cache: true,
    rateLimit: false,
  },
  async ({ input }) => {
    const client = getEffectClient(input.chainId);
    const addr = input.address as `0x${string}`;
    try {
      const mainIndex = await client.readContract({ address: addr, abi: LINEAR_ABI, functionName: "getMainIndex" }) as bigint;
      const wrappedIndex = await client.readContract({ address: addr, abi: LINEAR_ABI, functionName: "getWrappedIndex" }) as bigint;
      const targets = await client.readContract({ address: addr, abi: LINEAR_ABI, functionName: "getTargets" }) as [bigint, bigint];
      return {
        mainIndex: Number(mainIndex),
        wrappedIndex: Number(wrappedIndex),
        lowerTarget: targets[0].toString(),
        upperTarget: targets[1].toString(),
      };
    } catch {
      return null;
    }
  }
);

export const getGyro2Params = createEffect(
  {
    name: "v2GetGyro2Params",
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
        functionName: "getSqrtParameters",
      }) as bigint[];
      return {
        sqrtAlpha: result[0]!.toString(),
        sqrtBeta: result[1]!.toString(),
      };
    } catch {
      return null;
    }
  }
);

export const getGyroEParams = createEffect(
  {
    name: "v2GetGyroEParams",
    input: S.schema({ address: S.string, chainId: S.number }),
    output: S.union([
      S.schema({
        alpha: S.string, beta: S.string, c: S.string, s: S.string, lambda: S.string,
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
      const result = await client.readContract({
        address: input.address as `0x${string}`,
        abi: GYROE_ABI,
        functionName: "getECLPParams",
      }) as any;
      const [params, derived] = result;
      return {
        alpha: params.alpha.toString(),
        beta: params.beta.toString(),
        c: params.c.toString(),
        s: params.s.toString(),
        lambda: params.lambda.toString(),
        tauAlphaX: derived.tauAlpha_x.toString(),
        tauAlphaY: derived.tauAlpha_y.toString(),
        tauBetaX: derived.tauBeta_x.toString(),
        tauBetaY: derived.tauBeta_y.toString(),
        u: derived.u.toString(),
        v: derived.v.toString(),
        w: derived.w.toString(),
        z: derived.z.toString(),
        dSq: derived.dSq.toString(),
      };
    } catch {
      return null;
    }
  }
);
