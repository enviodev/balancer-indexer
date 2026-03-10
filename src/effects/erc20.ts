import { createEffect, S } from "envio";
import { parseAbi } from "viem";
import { getEffectClient } from "./rpc.js";

const ERC20_ABI = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
]);

export const getTokenMetadata = createEffect(
  {
    name: "getTokenMetadata",
    input: S.schema({
      address: S.string,
      chainId: S.number,
    }),
    output: S.schema({
      name: S.string,
      symbol: S.string,
      decimals: S.number,
    }),
    cache: true,
    rateLimit: false,
  },
  async ({ input }) => {
    const client = getEffectClient(input.chainId);
    const addr = input.address as `0x${string}`;

    try {
      const [name, symbol, decimals] = await Promise.all([
        client.readContract({ address: addr, abi: ERC20_ABI, functionName: "name" }).catch(() => ""),
        client.readContract({ address: addr, abi: ERC20_ABI, functionName: "symbol" }).catch(() => ""),
        client.readContract({ address: addr, abi: ERC20_ABI, functionName: "decimals" }).catch(() => 18),
      ]);
      // Strip null bytes — PostgreSQL rejects \u0000 in text/JSON fields
      const sanitize = (s: string) => s.replace(/\0/g, "");
      return { name: sanitize(name as string), symbol: sanitize(symbol as string), decimals: Number(decimals) };
    } catch {
      return { name: "", symbol: "", decimals: 18 };
    }
  }
);
