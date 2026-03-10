import { createEffect, S } from "envio";
import { parseAbi } from "viem";
import { getEffectClient } from "./rpc.js";

const VAULT_ABI = parseAbi([
  "function getPool(bytes32 poolId) view returns (address, uint8)",
  "function getPoolTokens(bytes32 poolId) view returns (address[] tokens, uint256[] balances, uint256 lastChangeBlock)",
  "function getProtocolFeesCollector() view returns (address)",
]);

export const getPoolAddress = createEffect(
  {
    name: "getPoolAddress",
    input: S.schema({ vaultAddress: S.string, poolId: S.string, chainId: S.number }),
    output: S.schema({ address: S.string, specialization: S.number }),
    cache: true,
    rateLimit: false,
  },
  async ({ input }) => {
    const client = getEffectClient(input.chainId);
    try {
      const result = await client.readContract({
        address: input.vaultAddress as `0x${string}`,
        abi: VAULT_ABI,
        functionName: "getPool",
        args: [input.poolId as `0x${string}`],
      }) as [string, number];
      return { address: result[0], specialization: Number(result[1]) };
    } catch {
      return { address: "0x0000000000000000000000000000000000000000", specialization: 0 };
    }
  }
);

export const getPoolTokens = createEffect(
  {
    name: "v2GetPoolTokens",
    input: S.schema({ vaultAddress: S.string, poolId: S.string, chainId: S.number }),
    output: S.schema({ tokens: S.array(S.string), balances: S.array(S.string) }),
    cache: true,
    rateLimit: false,
  },
  async ({ input }) => {
    const client = getEffectClient(input.chainId);
    try {
      const result = await client.readContract({
        address: input.vaultAddress as `0x${string}`,
        abi: VAULT_ABI,
        functionName: "getPoolTokens",
        args: [input.poolId as `0x${string}`],
      }) as [string[], bigint[], bigint];
      return {
        tokens: result[0],
        balances: result[1].map(b => b.toString()),
      };
    } catch {
      return { tokens: [], balances: [] };
    }
  }
);

export const getProtocolFeesCollector = createEffect(
  {
    name: "v2GetProtocolFeesCollector",
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
        abi: VAULT_ABI,
        functionName: "getProtocolFeesCollector",
      });
      return result as string;
    } catch {
      return "0x0000000000000000000000000000000000000000";
    }
  }
);
