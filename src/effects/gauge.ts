import { createEffect, S } from "envio";
import { parseAbi } from "viem";
import { getEffectClient } from "./rpc.js";

const GAUGE_ABI = parseAbi([
  "function lp_token() view returns (address)",
  "function symbol() view returns (string)",
  "function getRecipient() view returns (address)",
  "function is_killed() view returns (bool)",
  "function reward_data(address) view returns (address distributor, uint256 period_finish, uint256 rate, uint256 last_update, uint256 integral)",
  "function getRelativeWeightCap() view returns (uint256)",
]);

const POOL_ABI = parseAbi([
  "function getPoolId() view returns (bytes32)",
]);

export const getLpToken = createEffect(
  {
    name: "getLpToken",
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
        abi: GAUGE_ABI,
        functionName: "lp_token",
      });
      return result as string;
    } catch {
      return null;
    }
  }
);

export const getGaugeSymbol = createEffect(
  {
    name: "getGaugeSymbol",
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
        abi: GAUGE_ABI,
        functionName: "symbol",
      });
      return result as string;
    } catch {
      return null;
    }
  }
);

export const getGaugeRecipient = createEffect(
  {
    name: "getGaugeRecipient",
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
        abi: GAUGE_ABI,
        functionName: "getRecipient",
      });
      return result as string;
    } catch {
      return null;
    }
  }
);

export const getGaugeIsKilled = createEffect(
  {
    name: "getGaugeIsKilled",
    input: S.schema({ address: S.string, chainId: S.number }),
    output: S.union([S.boolean, null]),
    cache: false,
    rateLimit: false,
  },
  async ({ input }) => {
    const client = getEffectClient(input.chainId);
    try {
      const result = await client.readContract({
        address: input.address as `0x${string}`,
        abi: GAUGE_ABI,
        functionName: "is_killed",
      });
      return result as boolean;
    } catch {
      return null;
    }
  }
);

export const getGaugeRewardData = createEffect(
  {
    name: "getGaugeRewardData",
    input: S.schema({ address: S.string, tokenAddress: S.string, chainId: S.number, blockNumber: S.number }),
    output: S.union([
      S.schema({ rate: S.string, period_finish: S.string }),
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
        abi: GAUGE_ABI,
        functionName: "reward_data",
        args: [input.tokenAddress as `0x${string}`],
        blockNumber: BigInt(input.blockNumber),
      });
      const [, periodFinish, rate] = result as [string, bigint, bigint, bigint, bigint];
      return {
        rate: rate.toString(),
        period_finish: periodFinish.toString(),
      };
    } catch {
      return null;
    }
  }
);

export const getPoolIdFromGauge = createEffect(
  {
    name: "getPoolIdFromGauge",
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

const STREAMER_ABI = parseAbi([
  "function reward_receiver() view returns (address)",
]);

export const getRewardReceiver = createEffect(
  {
    name: "getRewardReceiver",
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
        abi: STREAMER_ABI,
        functionName: "reward_receiver",
      });
      return result as string;
    } catch {
      return null;
    }
  }
);

export const getGaugeRelativeWeightCap = createEffect(
  {
    name: "getGaugeRelativeWeightCap",
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
        abi: GAUGE_ABI,
        functionName: "getRelativeWeightCap",
      });
      return (result as bigint).toString();
    } catch {
      return null;
    }
  }
);
