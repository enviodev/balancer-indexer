import { V2PoolFactory } from "generated";
import BigDecimal from "bignumber.js";
import { ZERO_BD, ZERO_BI, ZERO_ADDRESS, V2_VAULT_ADDRESS } from "../../utils/constants.js";
import { scaleDown, tokenToDecimal } from "../../utils/math.js";
import { makeChainId, defaultUser, defaultToken } from "../../utils/entities.js";
import {
  defaultV2Balancer,
  defaultV2Pool,
  defaultV2PoolToken,
  defaultV2PoolContract,
} from "../../utils/v2/entities.js";
import {
  getPoolTypeFromFactory,
  isWeightedPoolType,
  isStablePoolType,
  isLinearPoolType,
} from "../../utils/v2/pools.js";
import { getTokenMetadata } from "../../effects/erc20.js";
import {
  getPoolId as v2GetPoolId,
  getSwapFeePercentage,
  getWeights,
  getAmp,
  getLinearTargets,
  getPoolOwner,
} from "../../effects/v2Pool.js";
import { getPoolTokens } from "../../effects/v2Vault.js";

// ================================
// Pool Created - Contract Registration
// ================================

V2PoolFactory.PoolCreated.contractRegister(({ event, context }) => {
  context.addV2Pool(event.params.pool);
});

// ================================
// Pool Created - Handler
// ================================

V2PoolFactory.PoolCreated.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const poolAddress = event.params.pool;
  const factoryAddress = event.srcAddress;
  const vaultId = makeChainId(chainId, V2_VAULT_ADDRESS);

  // Determine pool type from factory address
  const poolTypeInfo = getPoolTypeFromFactory(factoryAddress);
  const poolType = poolTypeInfo.poolType;
  const poolTypeVersion = poolTypeInfo.poolTypeVersion;

  // RPC calls: get poolId, swap fee, owner, and pool metadata
  const poolIdBytes32 = await context.effect(v2GetPoolId, {
    address: poolAddress,
    chainId,
  });

  if (!poolIdBytes32) return;

  const poolTokensResult = await context.effect(getPoolTokens, {
    vaultAddress: V2_VAULT_ADDRESS,
    poolId: poolIdBytes32,
    chainId,
  });

  const swapFeeRaw = await context.effect(getSwapFeePercentage, {
    address: poolAddress,
    chainId,
  });

  const owner = await context.effect(getPoolOwner, {
    address: poolAddress,
    chainId,
  });

  // Get pool BPT metadata (name, symbol, decimals)
  const poolMeta = await context.effect(getTokenMetadata, {
    address: poolAddress,
    chainId,
  });

  // Ensure V2Balancer entity exists
  let vault = await context.V2Balancer.get(vaultId);
  if (!vault) {
    vault = defaultV2Balancer(chainId, V2_VAULT_ADDRESS);
    context.V2Balancer.set(vault);
  }

  // Build token list
  const tokenAddresses = poolTokensResult.tokens.map((t: string) => t.toLowerCase());

  // Create V2Pool entity
  const pool = {
    ...defaultV2Pool(chainId, poolAddress),
    poolType,
    poolTypeVersion,
    factory: factoryAddress,
    symbol: poolMeta.symbol,
    name: poolMeta.name,
    owner: owner ?? undefined,
    swapFee: scaleDown(BigInt(swapFeeRaw), 18),
    createTime: event.block.timestamp,
    vaultID_id: vaultId,
    tx: event.transaction.hash ?? undefined,
    tokensList: tokenAddresses,
  };

  // Pool-type-specific fields
  if (isWeightedPoolType(poolType)) {
    const weights = await context.effect(getWeights, {
      address: poolAddress,
      chainId,
    });

    // Calculate total weight
    let totalWeight = ZERO_BD;
    for (const w of weights) {
      totalWeight = totalWeight.plus(scaleDown(BigInt(w), 18));
    }
    pool.totalWeight = totalWeight;

    // Create pool token entities with weights
    for (let i = 0; i < tokenAddresses.length; i++) {
      const tokenAddress = tokenAddresses[i]!;
      const meta = await context.effect(getTokenMetadata, {
        address: tokenAddress,
        chainId,
      });

      const poolToken = {
        ...defaultV2PoolToken(chainId, poolAddress, tokenAddress, i),
        symbol: meta.symbol,
        name: meta.name,
        decimals: meta.decimals,
        balance: tokenToDecimal(BigInt(poolTokensResult.balances[i] ?? "0"), meta.decimals),
        weight: weights[i] ? scaleDown(BigInt(weights[i]!), 18) : undefined,
      };
      context.V2PoolToken.set(poolToken);

      // Create/update Token entity
      context.Token.set({
        ...defaultToken(chainId, tokenAddress),
        name: meta.name,
        symbol: meta.symbol,
        decimals: meta.decimals,
      });
    }
  } else if (isStablePoolType(poolType)) {
    const ampRaw = await context.effect(getAmp, {
      address: poolAddress,
      chainId,
    });

    if (ampRaw) {
      pool.amp = BigInt(ampRaw);
    }

    // Create pool token entities (no weights for stable pools)
    for (let i = 0; i < tokenAddresses.length; i++) {
      const tokenAddress = tokenAddresses[i]!;
      const meta = await context.effect(getTokenMetadata, {
        address: tokenAddress,
        chainId,
      });

      const poolToken = {
        ...defaultV2PoolToken(chainId, poolAddress, tokenAddress, i),
        symbol: meta.symbol,
        name: meta.name,
        decimals: meta.decimals,
        balance: tokenToDecimal(BigInt(poolTokensResult.balances[i] ?? "0"), meta.decimals),
      };
      context.V2PoolToken.set(poolToken);

      context.Token.set({
        ...defaultToken(chainId, tokenAddress),
        name: meta.name,
        symbol: meta.symbol,
        decimals: meta.decimals,
      });
    }
  } else if (isLinearPoolType(poolType)) {
    const targets = await context.effect(getLinearTargets, {
      address: poolAddress,
      chainId,
    });

    if (targets) {
      pool.mainIndex = targets.mainIndex;
      pool.wrappedIndex = targets.wrappedIndex;
      pool.lowerTarget = scaleDown(BigInt(targets.lowerTarget), 18);
      pool.upperTarget = scaleDown(BigInt(targets.upperTarget), 18);
    }

    // Create pool token entities
    for (let i = 0; i < tokenAddresses.length; i++) {
      const tokenAddress = tokenAddresses[i]!;
      const meta = await context.effect(getTokenMetadata, {
        address: tokenAddress,
        chainId,
      });

      const poolToken = {
        ...defaultV2PoolToken(chainId, poolAddress, tokenAddress, i),
        symbol: meta.symbol,
        name: meta.name,
        decimals: meta.decimals,
        balance: tokenToDecimal(BigInt(poolTokensResult.balances[i] ?? "0"), meta.decimals),
      };
      context.V2PoolToken.set(poolToken);

      context.Token.set({
        ...defaultToken(chainId, tokenAddress),
        name: meta.name,
        symbol: meta.symbol,
        decimals: meta.decimals,
      });
    }
  } else {
    // Generic pool type: create tokens without type-specific fields
    for (let i = 0; i < tokenAddresses.length; i++) {
      const tokenAddress = tokenAddresses[i]!;
      const meta = await context.effect(getTokenMetadata, {
        address: tokenAddress,
        chainId,
      });

      const poolToken = {
        ...defaultV2PoolToken(chainId, poolAddress, tokenAddress, i),
        symbol: meta.symbol,
        name: meta.name,
        decimals: meta.decimals,
        balance: tokenToDecimal(BigInt(poolTokensResult.balances[i] ?? "0"), meta.decimals),
      };
      context.V2PoolToken.set(poolToken);

      context.Token.set({
        ...defaultToken(chainId, tokenAddress),
        name: meta.name,
        symbol: meta.symbol,
        decimals: meta.decimals,
      });
    }
  }

  // Set the pool entity
  context.V2Pool.set(pool);

  // Create V2PoolContract entity
  context.V2PoolContract.set(defaultV2PoolContract(chainId, poolAddress));

  // Create Token entity for the pool BPT itself
  context.Token.set({
    ...defaultToken(chainId, poolAddress),
    name: poolMeta.name,
    symbol: poolMeta.symbol,
    decimals: poolMeta.decimals,
  });

  // Increment V2Balancer pool count
  context.V2Balancer.set({
    ...vault,
    poolCount: vault.poolCount + 1,
  });
});
