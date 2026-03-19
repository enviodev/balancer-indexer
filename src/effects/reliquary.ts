import { createEffect, S } from "envio";
import { parseAbi } from "viem";
import { getEffectClient } from "./rpc.js";

const RELIQUARY_ABI = parseAbi([
  "function getPositionForId(uint256 relicId) view returns ((uint256 amount, uint256 rewardDebt, uint256 rewardCredit, uint256 entry, uint256 poolId, uint256 level))",
  "function getPoolInfo(uint256 pid) view returns ((uint256 accRewardPerShare, uint256 lastRewardTime, uint256 allocPoint, string name))",
  "function getLevelInfo(uint256 pid) view returns ((uint256[] requiredMaturity, uint256[] allocPoint, uint256[] balance))",
  "function rewardToken() view returns (address)",
  "function emissionCurve() view returns (address)",
]);

const EMISSION_CURVE_ABI = parseAbi([
  "function rewardPerSecond() view returns (uint256)",
]);

const REWARDER_ABI = parseAbi([
  "function rewardToken() view returns (address)",
]);

export const getReliquaryPositionForId = createEffect(
  {
    name: "getReliquaryPositionForId",
    input: S.schema({ address: S.string, chainId: S.number, relicId: S.string }),
    output: S.schema({
      amount: S.string,
      rewardDebt: S.string,
      rewardCredit: S.string,
      entry: S.string,
      poolId: S.string,
      level: S.string,
    }),
    cache: false,
    rateLimit: false,
  },
  async ({ input }) => {
    const client = getEffectClient(input.chainId);
    const result = await client.readContract({
      address: input.address as `0x${string}`,
      abi: RELIQUARY_ABI,
      functionName: "getPositionForId",
      args: [BigInt(input.relicId)],
    });
    return {
      amount: result.amount.toString(),
      rewardDebt: result.rewardDebt.toString(),
      rewardCredit: result.rewardCredit.toString(),
      entry: result.entry.toString(),
      poolId: result.poolId.toString(),
      level: result.level.toString(),
    };
  }
);

export const getReliquaryPoolInfo = createEffect(
  {
    name: "getReliquaryPoolInfo",
    input: S.schema({ address: S.string, chainId: S.number, pid: S.string }),
    output: S.schema({ name: S.string, allocPoint: S.string }),
    cache: true,
    rateLimit: false,
  },
  async ({ input }) => {
    const client = getEffectClient(input.chainId);
    const result = await client.readContract({
      address: input.address as `0x${string}`,
      abi: RELIQUARY_ABI,
      functionName: "getPoolInfo",
      args: [BigInt(input.pid)],
    });
    return { name: result.name, allocPoint: result.allocPoint.toString() };
  }
);

export const getReliquaryLevelInfo = createEffect(
  {
    name: "getReliquaryLevelInfo",
    input: S.schema({ address: S.string, chainId: S.number, pid: S.string }),
    output: S.schema({
      requiredMaturity: S.array(S.string),
      allocPoint: S.array(S.string),
    }),
    cache: true,
    rateLimit: false,
  },
  async ({ input }) => {
    const client = getEffectClient(input.chainId);
    const result = await client.readContract({
      address: input.address as `0x${string}`,
      abi: RELIQUARY_ABI,
      functionName: "getLevelInfo",
      args: [BigInt(input.pid)],
    });
    return {
      requiredMaturity: result.requiredMaturity.map((v: bigint) => v.toString()),
      allocPoint: result.allocPoint.map((v: bigint) => v.toString()),
    };
  }
);

export const getReliquaryRewardToken = createEffect(
  {
    name: "getReliquaryRewardToken",
    input: S.schema({ address: S.string, chainId: S.number }),
    output: S.schema({ rewardToken: S.string }),
    cache: true,
    rateLimit: false,
  },
  async ({ input }) => {
    const client = getEffectClient(input.chainId);
    const result = await client.readContract({
      address: input.address as `0x${string}`,
      abi: RELIQUARY_ABI,
      functionName: "rewardToken",
    });
    return { rewardToken: result };
  }
);

export const getReliquaryEmissionCurveAddress = createEffect(
  {
    name: "getReliquaryEmissionCurveAddress",
    input: S.schema({ address: S.string, chainId: S.number }),
    output: S.schema({ emissionCurve: S.string }),
    cache: true,
    rateLimit: false,
  },
  async ({ input }) => {
    const client = getEffectClient(input.chainId);
    const result = await client.readContract({
      address: input.address as `0x${string}`,
      abi: RELIQUARY_ABI,
      functionName: "emissionCurve",
    });
    return { emissionCurve: result };
  }
);

export const getEmissionCurveRewardPerSecond = createEffect(
  {
    name: "getEmissionCurveRewardPerSecond",
    input: S.schema({ address: S.string, chainId: S.number }),
    output: S.schema({ rewardPerSecond: S.string }),
    cache: false,
    rateLimit: false,
  },
  async ({ input }) => {
    const client = getEffectClient(input.chainId);
    try {
      const result = await client.readContract({
        address: input.address as `0x${string}`,
        abi: EMISSION_CURVE_ABI,
        functionName: "rewardPerSecond",
      });
      return { rewardPerSecond: result.toString() };
    } catch {
      return { rewardPerSecond: "0" };
    }
  }
);

export const getRewarderRewardToken = createEffect(
  {
    name: "getRewarderRewardToken",
    input: S.schema({ address: S.string, chainId: S.number }),
    output: S.schema({ rewardToken: S.string }),
    cache: true,
    rateLimit: false,
  },
  async ({ input }) => {
    const client = getEffectClient(input.chainId);
    const result = await client.readContract({
      address: input.address as `0x${string}`,
      abi: REWARDER_ABI,
      functionName: "rewardToken",
    });
    return { rewardToken: result };
  }
);
