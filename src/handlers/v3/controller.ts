import { V3ProtocolFeeController } from "generated";
import { ZERO_BD } from "../../utils/constants.js";
import { scaleDown } from "../../utils/math.js";
import { makeChainId, getPoolTokenId } from "../../utils/entities.js";
import { VAULT_ADDRESS } from "../../utils/constants.js";

V3ProtocolFeeController.GlobalProtocolSwapFeePercentageChanged.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const vaultId = makeChainId(chainId, VAULT_ADDRESS);
  const vault = await context.V3Vault.get(vaultId);
  if (!vault) return;
  context.V3Vault.set({ ...vault, protocolSwapFee: scaleDown(event.params.swapFeePercentage, 18) });
});

V3ProtocolFeeController.GlobalProtocolYieldFeePercentageChanged.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const vaultId = makeChainId(chainId, VAULT_ADDRESS);
  const vault = await context.V3Vault.get(vaultId);
  if (!vault) return;
  context.V3Vault.set({ ...vault, protocolYieldFee: scaleDown(event.params.yieldFeePercentage, 18) });
});

V3ProtocolFeeController.PoolCreatorSwapFeePercentageChanged.handler(async ({ event, context }) => {
  const poolId = makeChainId(event.chainId, event.params.pool);
  const pool = await context.V3Pool.get(poolId);
  if (!pool) return;
  context.V3Pool.set({ ...pool, poolCreatorSwapFee: scaleDown(event.params.poolCreatorSwapFeePercentage, 18) });
});

V3ProtocolFeeController.PoolCreatorYieldFeePercentageChanged.handler(async ({ event, context }) => {
  const poolId = makeChainId(event.chainId, event.params.pool);
  const pool = await context.V3Pool.get(poolId);
  if (!pool) return;
  context.V3Pool.set({ ...pool, poolCreatorYieldFee: scaleDown(event.params.poolCreatorYieldFeePercentage, 18) });
});

V3ProtocolFeeController.ProtocolSwapFeePercentageChanged.handler(async ({ event, context }) => {
  const poolId = makeChainId(event.chainId, event.params.pool);
  const pool = await context.V3Pool.get(poolId);
  if (!pool) return;
  context.V3Pool.set({ ...pool, protocolSwapFee: scaleDown(event.params.swapFeePercentage, 18) });
});

V3ProtocolFeeController.ProtocolYieldFeePercentageChanged.handler(async ({ event, context }) => {
  const poolId = makeChainId(event.chainId, event.params.pool);
  const pool = await context.V3Pool.get(poolId);
  if (!pool) return;
  context.V3Pool.set({ ...pool, protocolYieldFee: scaleDown(event.params.yieldFeePercentage, 18) });
});

V3ProtocolFeeController.ProtocolSwapFeeCollected.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const ptId = getPoolTokenId(chainId, event.params.pool, event.params.token);
  const pt = await context.V3PoolToken.get(ptId);
  if (!pt) return;

  context.V3PoolToken.set({
    ...pt,
    vaultProtocolSwapFeeBalance: ZERO_BD,
    controllerProtocolFeeBalance: pt.controllerProtocolFeeBalance.plus(scaleDown(event.params.amount, pt.decimals)),
  });
});

V3ProtocolFeeController.ProtocolYieldFeeCollected.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const ptId = getPoolTokenId(chainId, event.params.pool, event.params.token);
  const pt = await context.V3PoolToken.get(ptId);
  if (!pt) return;

  context.V3PoolToken.set({
    ...pt,
    vaultProtocolYieldFeeBalance: ZERO_BD,
    controllerProtocolFeeBalance: pt.controllerProtocolFeeBalance.plus(scaleDown(event.params.amount, pt.decimals)),
  });
});

V3ProtocolFeeController.ProtocolFeesWithdrawn.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const ptId = getPoolTokenId(chainId, event.params.pool, event.params.token);
  const pt = await context.V3PoolToken.get(ptId);
  if (!pt) return;

  context.V3PoolToken.set({
    ...pt,
    controllerProtocolFeeBalance: pt.controllerProtocolFeeBalance.minus(scaleDown(event.params.amount, pt.decimals)),
  });
});
