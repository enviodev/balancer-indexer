import BigDecimal from "bignumber.js";
import type {
  V3Pool,
  V3PoolToken,
  V3PoolSnapshot,
  V3PoolShare,
  V3Vault,
  V3Hook,
  V3HookConfig,
  V3LiquidityManagement,
  V3RateProvider,
  V3Buffer,
  V3BufferShare,
  Token,
  User,
  V3Factory,
  V3PoolTypeInfo,
} from "generated";
import { ZERO_BD, ZERO_BI, ZERO_ADDRESS, ONE_BD } from "./constants.js";

const DAY = 24 * 60 * 60;

export function makeChainId(chainId: number, id: string): string {
  return `${chainId}-${id}`;
}

export function getPoolShareId(chainId: number, poolAddress: string, userAddress: string): string {
  return `${chainId}-${poolAddress}-${userAddress}`;
}

export function getPoolTokenId(chainId: number, poolAddress: string, tokenAddress: string): string {
  return `${chainId}-${poolAddress}-${tokenAddress}`;
}

export function defaultUser(chainId: number, address: string): User {
  return {
    id: makeChainId(chainId, address),
  };
}

export function defaultToken(chainId: number, address: string): Token {
  return {
    id: makeChainId(chainId, address),
    name: "",
    symbol: "",
    decimals: 18,
    address,
    latestUSDPrice: undefined,
    latestUSDPriceTimestamp: undefined,
    latestFXPrice: undefined,
    latestPrice_id: undefined,
    pool_id: undefined,
    fxOracleDecimals: undefined,
  };
}

export function defaultV3Vault(chainId: number, vaultAddress: string) {
  return {
    id: makeChainId(chainId, vaultAddress),
    isPaused: false,
    authorizer: ZERO_ADDRESS,
    protocolSwapFee: ZERO_BD,
    protocolYieldFee: ZERO_BD,
    protocolFeeController: ZERO_ADDRESS,
  };
}

export function defaultV3Pool(chainId: number, poolAddress: string): V3Pool {
  return {
    id: makeChainId(chainId, poolAddress),
    vault_id: "",
    hook_id: "",
    hookConfig_id: "",
    liquidityManagement_id: "",
    factory: ZERO_ADDRESS,
    address: poolAddress,
    name: "",
    symbol: "",
    swapFee: ZERO_BD,
    totalShares: ZERO_BD,
    pauseWindowEndTime: ZERO_BI,
    blockNumber: ZERO_BI,
    blockTimestamp: ZERO_BI,
    transactionHash: "",
    isInitialized: false,
    isPaused: false,
    isInRecoveryMode: false,
    pauseManager: ZERO_ADDRESS,
    swapFeeManager: ZERO_ADDRESS,
    poolCreator: ZERO_ADDRESS,
    protocolSwapFee: ZERO_BD,
    protocolYieldFee: ZERO_BD,
    poolCreatorSwapFee: ZERO_BD,
    poolCreatorYieldFee: ZERO_BD,
    swapsCount: ZERO_BI,
    holdersCount: ZERO_BI,
  };
}

export function defaultV3PoolToken(
  chainId: number,
  poolAddress: string,
  tokenAddress: string,
  index: number
): V3PoolToken {
  return {
    id: getPoolTokenId(chainId, poolAddress, tokenAddress),
    pool_id: makeChainId(chainId, poolAddress),
    index,
    name: "",
    symbol: "",
    decimals: 18,
    address: tokenAddress,
    balance: ZERO_BD,
    volume: ZERO_BD,
    totalSwapFee: ZERO_BD,
    totalSwapFeeBase: ZERO_BD,
    totalSwapFeeDelta: ZERO_BD,
    totalStaticSwapFee: ZERO_BD,
    totalDynamicSwapFee: ZERO_BD,
    buffer_id: undefined,
    nestedPool_id: undefined,
    priceRate: ONE_BD,
    scalingFactor: 10n ** BigInt(18 - 18),
    totalProtocolSwapFee: ZERO_BD,
    totalProtocolYieldFee: ZERO_BD,
    paysYieldFees: false,
    controllerProtocolFeeBalance: ZERO_BD,
    vaultProtocolSwapFeeBalance: ZERO_BD,
    vaultProtocolYieldFeeBalance: ZERO_BD,
  };
}

export function defaultV3PoolShare(
  chainId: number,
  poolAddress: string,
  userAddress: string
): V3PoolShare {
  return {
    id: getPoolShareId(chainId, poolAddress, userAddress),
    pool_id: makeChainId(chainId, poolAddress),
    user_id: makeChainId(chainId, userAddress),
    balance: ZERO_BD,
  };
}

export function createSnapshotId(chainId: number, poolAddress: string, timestamp: number): string {
  const dayTimestamp = timestamp - (timestamp % DAY);
  return `${chainId}-${poolAddress}-${dayTimestamp}`;
}

export function defaultV3PoolSnapshot(
  chainId: number,
  poolAddress: string,
  timestamp: number
): V3PoolSnapshot {
  const dayTimestamp = timestamp - (timestamp % DAY);
  return {
    id: createSnapshotId(chainId, poolAddress, timestamp),
    pool_id: makeChainId(chainId, poolAddress),
    timestamp: dayTimestamp,
    totalShares: ZERO_BD,
    swapsCount: ZERO_BI,
    holdersCount: ZERO_BI,
    balances: [],
    totalSwapFees: [],
    totalStaticSwapFees: [],
    totalDynamicSwapFees: [],
    totalSwapVolumes: [],
    totalProtocolSwapFees: [],
    totalProtocolYieldFees: [],
  };
}
