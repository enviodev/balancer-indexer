import BigDecimal from "bignumber.js";
import { ZERO_BD, ZERO_BI, ZERO_ADDRESS } from "../constants.js";
import { makeChainId } from "../entities.js";

const DAY = 24 * 60 * 60;

export function v2PoolShareId(chainId: number, poolAddress: string, userAddress: string): string {
  return `${chainId}-${poolAddress}-${userAddress}`;
}

export function v2PoolTokenId(chainId: number, poolId: string, tokenAddress: string): string {
  return `${chainId}-${poolId}-${tokenAddress}`;
}

export function defaultV2Balancer(chainId: number, vaultAddress: string) {
  return {
    id: makeChainId(chainId, vaultAddress),
    poolCount: 0,
    totalLiquidity: ZERO_BD,
    totalSwapCount: ZERO_BI,
    totalSwapVolume: ZERO_BD,
    totalSwapFee: ZERO_BD,
    totalProtocolFee: ZERO_BD,
    protocolFeesCollector: ZERO_ADDRESS,
  };
}

export function defaultV2Pool(chainId: number, poolAddress: string) {
  return {
    id: makeChainId(chainId, poolAddress),
    address: poolAddress,
    poolType: undefined as string | undefined,
    poolTypeVersion: undefined as number | undefined,
    factory: undefined as string | undefined,
    strategyType: 0,
    oracleEnabled: false,
    symbol: undefined as string | undefined,
    name: undefined as string | undefined,
    swapEnabled: true,
    swapEnabledInternal: undefined as boolean | undefined,
    swapEnabledCurationSignal: undefined as boolean | undefined,
    swapFee: ZERO_BD,
    owner: undefined as string | undefined,
    isPaused: undefined as boolean | undefined,
    totalWeight: undefined as BigDecimal | undefined,
    totalSwapVolume: ZERO_BD,
    totalSwapFee: ZERO_BD,
    totalLiquidity: ZERO_BD,
    totalLiquiditySansBPT: undefined as BigDecimal | undefined,
    totalShares: ZERO_BD,
    totalProtocolFee: undefined as BigDecimal | undefined,
    createTime: 0,
    swapsCount: ZERO_BI,
    holdersCount: ZERO_BI,
    vaultID_id: "",
    tx: undefined as string | undefined,
    tokensList: [] as string[],
    amp: undefined as bigint | undefined,
    latestAmpUpdate_id: undefined as string | undefined,
    principalToken: undefined as string | undefined,
    baseToken: undefined as string | undefined,
    expiryTime: undefined as bigint | undefined,
    unitSeconds: undefined as bigint | undefined,
    managementFee: undefined as BigDecimal | undefined,
    joinExitEnabled: undefined as boolean | undefined,
    mustAllowlistLPs: undefined as boolean | undefined,
    managementAumFee: undefined as BigDecimal | undefined,
    totalAumFeeCollectedInBPT: undefined as BigDecimal | undefined,
    mainIndex: undefined as number | undefined,
    wrappedIndex: undefined as number | undefined,
    lowerTarget: undefined as BigDecimal | undefined,
    upperTarget: undefined as BigDecimal | undefined,
    sqrtAlpha: undefined as BigDecimal | undefined,
    sqrtBeta: undefined as BigDecimal | undefined,
    root3Alpha: undefined as BigDecimal | undefined,
    c: undefined as BigDecimal | undefined,
    s: undefined as BigDecimal | undefined,
    tauAlphaX: undefined as BigDecimal | undefined,
    tauAlphaY: undefined as BigDecimal | undefined,
    tauBetaX: undefined as BigDecimal | undefined,
    tauBetaY: undefined as BigDecimal | undefined,
    u: undefined as BigDecimal | undefined,
    v: undefined as BigDecimal | undefined,
    w: undefined as BigDecimal | undefined,
    z: undefined as BigDecimal | undefined,
    dSq: undefined as BigDecimal | undefined,
    alpha: undefined as BigDecimal | undefined,
    beta: undefined as BigDecimal | undefined,
    lambda: undefined as BigDecimal | undefined,
    delta: undefined as BigDecimal | undefined,
    epsilon: undefined as BigDecimal | undefined,
    isInRecoveryMode: undefined as boolean | undefined,
    protocolSwapFeeCache: undefined as BigDecimal | undefined,
    protocolYieldFeeCache: undefined as BigDecimal | undefined,
    protocolAumFeeCache: undefined as BigDecimal | undefined,
    totalProtocolFeePaidInBPT: undefined as BigDecimal | undefined,
    lastJoinExitAmp: undefined as bigint | undefined,
    lastPostJoinExitInvariant: undefined as BigDecimal | undefined,
    protocolId: undefined as number | undefined,
    protocolIdData_id: undefined as string | undefined,
  };
}

export function defaultV2PoolToken(
  chainId: number,
  poolId: string,
  tokenAddress: string,
  index: number,
) {
  return {
    id: v2PoolTokenId(chainId, poolId, tokenAddress),
    pool_id: makeChainId(chainId, poolId),
    token_id: makeChainId(chainId, tokenAddress),
    assetManager: ZERO_ADDRESS,
    symbol: "",
    name: "",
    decimals: 18,
    index,
    address: tokenAddress,
    oldPriceRate: undefined as BigDecimal | undefined,
    priceRate: new BigDecimal(1),
    balance: ZERO_BD,
    paidProtocolFees: undefined as BigDecimal | undefined,
    cashBalance: ZERO_BD,
    managedBalance: ZERO_BD,
    weight: undefined as BigDecimal | undefined,
    isExemptFromYieldProtocolFee: undefined as boolean | undefined,
    circuitBreaker_id: undefined as string | undefined,
  };
}

export function defaultV2PoolShare(
  chainId: number,
  poolAddress: string,
  userAddress: string,
) {
  return {
    id: v2PoolShareId(chainId, poolAddress, userAddress),
    pool_id: makeChainId(chainId, poolAddress),
    user_id: makeChainId(chainId, userAddress),
    balance: ZERO_BD,
  };
}

export function defaultV2PoolContract(chainId: number, poolAddress: string) {
  return {
    id: makeChainId(chainId, poolAddress),
    pool_id: makeChainId(chainId, poolAddress),
  };
}

export function v2SnapshotId(chainId: number, poolAddress: string, timestamp: number): string {
  const dayTimestamp = timestamp - (timestamp % DAY);
  return `${chainId}-${poolAddress}-${dayTimestamp}`;
}

export function defaultV2PoolSnapshot(
  chainId: number,
  poolAddress: string,
  timestamp: number,
) {
  const dayTimestamp = timestamp - (timestamp % DAY);
  return {
    id: v2SnapshotId(chainId, poolAddress, timestamp),
    pool_id: makeChainId(chainId, poolAddress),
    amounts: [] as BigDecimal[],
    totalShares: ZERO_BD,
    swapVolume: ZERO_BD,
    protocolFee: undefined as BigDecimal | undefined,
    swapFees: ZERO_BD,
    liquidity: ZERO_BD,
    swapsCount: ZERO_BI,
    holdersCount: ZERO_BI,
    timestamp: dayTimestamp,
  };
}

export function defaultV2BalancerSnapshot(
  chainId: number,
  vaultAddress: string,
  timestamp: number,
) {
  const dayTimestamp = timestamp - (timestamp % DAY);
  return {
    id: `${chainId}-${vaultAddress}-${dayTimestamp}`,
    vault_id: makeChainId(chainId, vaultAddress),
    timestamp: dayTimestamp,
    poolCount: 0,
    totalLiquidity: ZERO_BD,
    totalSwapCount: ZERO_BI,
    totalSwapVolume: ZERO_BD,
    totalSwapFee: ZERO_BD,
    totalProtocolFee: undefined as BigDecimal | undefined,
  };
}
