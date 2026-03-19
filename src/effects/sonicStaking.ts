import { createEffect, S } from "envio";
import { parseAbi } from "viem";
import { getEffectClient } from "./rpc.js";

const SONIC_STAKING_ABI = parseAbi([
  "function totalPool() view returns (uint256)",
  "function totalDelegated() view returns (uint256)",
  "function totalAssets() view returns (uint256)",
  "function getRate() view returns (uint256)",
]);

export const getSonicStakingState = createEffect(
  {
    name: "getSonicStakingState",
    input: S.schema({ address: S.string, chainId: S.number }),
    output: S.schema({
      totalPool: S.string,
      totalDelegated: S.string,
      totalAssets: S.string,
      rate: S.string,
    }),
    cache: false,
    rateLimit: false,
  },
  async ({ input }) => {
    const client = getEffectClient(input.chainId);
    const addr = input.address as `0x${string}`;
    const [totalPool, totalDelegated, totalAssets, rate] = await Promise.all([
      client.readContract({ address: addr, abi: SONIC_STAKING_ABI, functionName: "totalPool" }),
      client.readContract({ address: addr, abi: SONIC_STAKING_ABI, functionName: "totalDelegated" }),
      client.readContract({ address: addr, abi: SONIC_STAKING_ABI, functionName: "totalAssets" }),
      client.readContract({ address: addr, abi: SONIC_STAKING_ABI, functionName: "getRate" }),
    ]);
    return {
      totalPool: totalPool.toString(),
      totalDelegated: totalDelegated.toString(),
      totalAssets: totalAssets.toString(),
      rate: rate.toString(),
    };
  }
);
