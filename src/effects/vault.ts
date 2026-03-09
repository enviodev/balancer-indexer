import { createEffect, S } from "envio";
import { parseAbi } from "viem";
import { getEffectClient } from "./rpc.js";

const VAULT_EXTENSION_ABI = parseAbi([
  "function getProtocolFeeController() view returns (address)",
  "function getStaticSwapFeePercentage(address pool) view returns (uint256)",
  "function getPoolTokenInfo(address pool) view returns (address[] tokens, (uint8,address,bool)[] tokenInfo, uint256[] balancesRaw, uint256[] lastBalancesLiveScaled18)",
  "function getAggregateYieldFeeAmount(address pool, address token) view returns (uint256)",
]);

const ERC4626_ABI = parseAbi([
  "function asset() view returns (address)",
]);

export const getProtocolFeeController = createEffect(
  {
    name: "getProtocolFeeController",
    input: S.schema({ vaultAddress: S.string, chainId: S.number }),
    output: S.string,
    cache: true,
    rateLimit: false,
  },
  async ({ input }) => {
    const client = getEffectClient(input.chainId);
    try {
      const result = await client.readContract({
        address: input.vaultAddress as `0x${string}`,
        abi: VAULT_EXTENSION_ABI,
        functionName: "getProtocolFeeController",
      });
      return result as string;
    } catch {
      return "0x0000000000000000000000000000000000000000";
    }
  }
);

export const getStaticSwapFeePercentage = createEffect(
  {
    name: "getStaticSwapFeePercentage",
    input: S.schema({ vaultAddress: S.string, poolAddress: S.string, chainId: S.number }),
    output: S.string,
    cache: true,
    rateLimit: false,
  },
  async ({ input }) => {
    const client = getEffectClient(input.chainId);
    try {
      const result = await client.readContract({
        address: input.vaultAddress as `0x${string}`,
        abi: VAULT_EXTENSION_ABI,
        functionName: "getStaticSwapFeePercentage",
        args: [input.poolAddress as `0x${string}`],
      });
      return (result as bigint).toString();
    } catch {
      return "0";
    }
  }
);

export const getPoolTokenBalances = createEffect(
  {
    name: "getPoolTokenBalances",
    input: S.schema({ vaultAddress: S.string, poolAddress: S.string, chainId: S.number, blockNumber: S.number }),
    output: S.array(S.string),
    cache: false,
    rateLimit: false,
  },
  async ({ input }) => {
    const client = getEffectClient(input.chainId);
    try {
      const result = await client.readContract({
        address: input.vaultAddress as `0x${string}`,
        abi: VAULT_EXTENSION_ABI,
        functionName: "getPoolTokenInfo",
        args: [input.poolAddress as `0x${string}`],
      }) as [string[], any[], bigint[], bigint[]];
      return result[2].map(b => b.toString());
    } catch {
      return [];
    }
  }
);

export const getAggregateYieldFeeAmount = createEffect(
  {
    name: "getAggregateYieldFeeAmount",
    input: S.schema({ vaultAddress: S.string, poolAddress: S.string, tokenAddress: S.string, chainId: S.number, blockNumber: S.number }),
    output: S.union([S.string, null]),
    cache: false,
    rateLimit: false,
  },
  async ({ input }) => {
    const client = getEffectClient(input.chainId);
    try {
      const result = await client.readContract({
        address: input.vaultAddress as `0x${string}`,
        abi: VAULT_EXTENSION_ABI,
        functionName: "getAggregateYieldFeeAmount",
        args: [input.poolAddress as `0x${string}`, input.tokenAddress as `0x${string}`],
      });
      return (result as bigint).toString();
    } catch {
      return null;
    }
  }
);

export const getERC4626Asset = createEffect(
  {
    name: "getERC4626Asset",
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
        abi: ERC4626_ABI,
        functionName: "asset",
      });
      return result as string;
    } catch {
      return null;
    }
  }
);
