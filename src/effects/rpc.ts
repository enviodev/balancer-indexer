/**
 * Shared RPC client for effects. Uses ENVIO_DRPC_API_KEY when set to route
 * contract reads through dRPC (https://lb.drpc.live/{chain}/{key}).
 */
import { createPublicClient, http, type PublicClient, type Chain, type Transport } from "viem";
import { mainnet, gnosis, arbitrum, base, optimism, avalanche, polygon, sepolia } from "viem/chains";

const chainMap: Record<number, Chain> = {
  1: mainnet,
  100: gnosis,
  42161: arbitrum,
  8453: base,
  10: optimism,
  43114: avalanche,
  137: polygon,
  11155111: sepolia,
};

/** dRPC chain name by chain ID */
const drpcChainNames: Record<number, string> = {
  1: "ethereum",
  100: "gnosis",
  42161: "arbitrum",
  8453: "base",
  10: "optimism",
  43114: "avalanche",
  137: "polygon",
  11155111: "sepolia",
  146: "sonic",
};

function getRpcUrl(chainId: number): string | undefined {
  const key = process.env.ENVIO_DRPC_API_KEY;
  if (!key) return undefined;

  const chainName = drpcChainNames[chainId];
  if (!chainName) return undefined;

  return `https://lb.drpc.live/${chainName}/${key}`;
}

export function getEffectClient(chainId: number): PublicClient<Transport, Chain> {
  const chain = chainMap[chainId];
  const rpcUrl = getRpcUrl(chainId);
  const transport = rpcUrl ? http(rpcUrl, { batch: true }) : http();

  if (!chain) {
    return createPublicClient({ transport }) as PublicClient<Transport, Chain>;
  }
  return createPublicClient({ chain, transport }) as PublicClient<Transport, Chain>;
}
