import { indexer } from "envio";
import BigDecimal from "bignumber.js";
import { ZERO_BD } from "../../utils/constants.js";
import { makeChainId } from "../../utils/entities.js";
import {
  getLpToken,
  getGaugeSymbol,
  getGaugeRecipient,
} from "../../effects/gauge.js";

// ================================
// Root Gauge V2 Factory → Chain mapping
// ================================

const ROOT_GAUGE_V2_CHAIN_MAP: Record<string, string> = {
  "0x1c99324edc771c82a0dccb780cc7dda0045e50e7": "Arbitrum",
  "0xa98bce70c92ad2ef3288dbcd659bc0d6b62f8f13": "Polygon",
  "0x866d4b65694c66fbfd15dd6fa933d0a6b3940a36": "Optimism",
  "0x2a18b396829bc29f66a1e59fadd7a0269a6605e8": "Gnosis",
  "0x22625eedd92c81a219a83e1dc48f88d54786b017": "Avalanche",
  "0x8e3b64b3737097f283e965869e3503aa20f31e4d": "Base",
  "0x9bf951848288ccd87d06fac426150262cd3447de": "PolygonZkEvm",
  "0x18cc3c68a5e64b40c846aa6e45312cbcbb94f71b": "Fraxtal",
};

// ================================
// Helper: Get or create GaugeFactory
// ================================

async function getOrCreateGaugeFactory(
  context: any,
  chainId: number,
  factoryAddress: string
) {
  const factoryId = makeChainId(chainId, factoryAddress.toLowerCase());
  let factory = await context.GaugeFactory.get(factoryId);
  if (!factory) {
    factory = {
      id: factoryId,
      numGauges: 0,
    };
  }
  return { ...factory, numGauges: factory.numGauges + 1 };
}

// ================================
// Helper: Ensure User entity exists
// ================================

async function ensureUser(context: any, chainId: number, address: string) {
  const userId = makeChainId(chainId, address.toLowerCase());
  const existing = await context.User.get(userId);
  if (!existing) {
    context.User.set({ id: userId });
  }
}

// ================================
// Helper: Create LiquidityGauge from factory event
// ================================

async function handleLiquidityGaugeCreated(
  event: any,
  context: any,
  options: {
    isPreferentialGauge: boolean;
    streamer?: string;
  }
) {
  const chainId = event.chainId;
  const factoryAddress = event.srcAddress.toLowerCase();
  const gaugeAddress = event.params.gauge.toLowerCase();

  // Get or create GaugeFactory
  const factory = await getOrCreateGaugeFactory(context, chainId, factoryAddress);
  context.GaugeFactory.set(factory);

  // RPC: get lp_token (pool address)
  const poolAddress = await context.effect(getLpToken, {
    address: gaugeAddress,
    chainId,
  });

  // RPC: get symbol
  const symbol = await context.effect(getGaugeSymbol, {
    address: gaugeAddress,
    chainId,
  });

  const poolAddr = poolAddress ? poolAddress.toLowerCase() : "";

  // Create LiquidityGauge entity
  context.LiquidityGauge.set({
    id: makeChainId(chainId, gaugeAddress),
    symbol: symbol ?? "",
    gauge_id: undefined,
    pool_id: undefined,
    poolAddress: poolAddr,
    poolId: undefined,
    isKilled: false,
    isPreferentialGauge: options.isPreferentialGauge,
    relativeWeightCap: undefined,
    streamer: options.streamer?.toLowerCase(),
    factory_id: makeChainId(chainId, factoryAddress),
    totalSupply: ZERO_BD,
    rewardTokensList: undefined,
  });

  // Create/update GaugePool entity
  if (poolAddr) {
    const gaugePoolId = makeChainId(chainId, poolAddr);
    const existingGaugePool = await context.GaugePool.get(gaugePoolId);
    if (existingGaugePool) {
      const gaugesList = existingGaugePool.gaugesList.includes(makeChainId(chainId, gaugeAddress))
        ? existingGaugePool.gaugesList
        : [...existingGaugePool.gaugesList, makeChainId(chainId, gaugeAddress)];
      context.GaugePool.set({
        ...existingGaugePool,
        gaugesList,
      });
    } else {
      context.GaugePool.set({
        id: gaugePoolId,
        poolId: undefined,
        address: poolAddr,
        preferentialGauge_id: undefined,
        gaugesList: [makeChainId(chainId, gaugeAddress)],
      });
    }
  }

  // Create User entity for the gauge address
  await ensureUser(context, chainId, gaugeAddress);
}

// ================================
// Helper: Create SingleRecipientGauge from factory event
// ================================

async function handleSingleRecipientGaugeCreated(
  event: any,
  context: any
) {
  const chainId = event.chainId;
  const factoryAddress = event.srcAddress.toLowerCase();
  const gaugeAddress = event.params.gauge.toLowerCase();

  // Get or create GaugeFactory
  const factory = await getOrCreateGaugeFactory(context, chainId, factoryAddress);
  context.GaugeFactory.set(factory);

  // RPC: get recipient
  const recipient = await context.effect(getGaugeRecipient, {
    address: gaugeAddress,
    chainId,
  });

  // Create SingleRecipientGauge entity
  context.SingleRecipientGauge.set({
    id: makeChainId(chainId, gaugeAddress),
    recipient: recipient ? recipient.toLowerCase() : "",
    gauge_id: undefined,
    isKilled: false,
    relativeWeightCap: undefined,
    factory_id: makeChainId(chainId, factoryAddress),
  });
}

// ================================
// Helper: Create RootGauge from factory event
// ================================

async function handleRootGaugeCreated(
  event: any,
  context: any,
  chain: string
) {
  const chainId = event.chainId;
  const factoryAddress = event.srcAddress.toLowerCase();
  const gaugeAddress = event.params.gauge.toLowerCase();

  // Get or create GaugeFactory
  const factory = await getOrCreateGaugeFactory(context, chainId, factoryAddress);
  context.GaugeFactory.set(factory);

  // RPC: get recipient
  const recipient = await context.effect(getGaugeRecipient, {
    address: gaugeAddress,
    chainId,
  });

  // Create RootGauge entity
  context.RootGauge.set({
    id: makeChainId(chainId, gaugeAddress),
    chain,
    recipient: recipient ? recipient.toLowerCase() : "",
    gauge_id: undefined,
    isKilled: false,
    relativeWeightCap: undefined,
    factory_id: makeChainId(chainId, factoryAddress),
  });
}

// ================================================================
// 1. GaugeLiquidityV1Factory — GaugeCreated
// ================================================================

indexer.contractRegister(
  { contract: "GaugeLiquidityV1Factory", event: "GaugeCreated" },
  async ({ event, context }) => {
  context.chain.GaugeLiquidityGauge.add(event.params.gauge);
}
);

indexer.onEvent(
  { contract: "GaugeLiquidityV1Factory", event: "GaugeCreated" },
  async ({ event, context }) => {
  await handleLiquidityGaugeCreated(event, context, {
    isPreferentialGauge: false,
  });
}
);

// ================================================================
// 2. GaugeLiquidityV2Factory — LiquidityGaugeV2Created
// ================================================================

indexer.contractRegister(
  { contract: "GaugeLiquidityV2Factory", event: "LiquidityGaugeV2Created" },
  async ({ event, context }) => {
  context.chain.GaugeLiquidityGauge.add(event.params.gauge);
}
);

indexer.onEvent(
  { contract: "GaugeLiquidityV2Factory", event: "LiquidityGaugeV2Created" },
  async ({ event, context }) => {
  await handleLiquidityGaugeCreated(event, context, {
    isPreferentialGauge: false,
  });
}
);

// ================================================================
// 3. ChildChainGaugeV1Factory — RewardsOnlyGaugeCreated
// ================================================================

indexer.contractRegister(
  { contract: "ChildChainGaugeV1Factory", event: "RewardsOnlyGaugeCreated" },
  async ({ event, context }) => {
  context.chain.GaugeRewardsOnlyGauge.add(event.params.gauge);
  context.chain.GaugeChildChainStreamer.add(event.params.streamer);
}
);

indexer.onEvent(
  { contract: "ChildChainGaugeV1Factory", event: "RewardsOnlyGaugeCreated" },
  async ({ event, context }) => {
  await handleLiquidityGaugeCreated(event, context, {
    isPreferentialGauge: true,
    streamer: event.params.streamer,
  });
}
);

// ================================================================
// 4. ChildChainGaugeV2Factory — ChildChainGaugeV2Created
// ================================================================

indexer.contractRegister(
  { contract: "ChildChainGaugeV2Factory", event: "ChildChainGaugeV2Created" },
  async ({ event, context }) => {
  context.chain.GaugeLiquidityGauge.add(event.params.gauge);
}
);

indexer.onEvent(
  { contract: "ChildChainGaugeV2Factory", event: "ChildChainGaugeV2Created" },
  async ({ event, context }) => {
  await handleLiquidityGaugeCreated(event, context, {
    isPreferentialGauge: true,
  });
}
);

// ================================================================
// 5. SingleRecipientGaugeV1Factory — SingleRecipientGaugeCreated
// ================================================================

indexer.contractRegister(
  { contract: "SingleRecipientGaugeV1Factory", event: "SingleRecipientGaugeCreated" },
  async ({ event, context }) => {
  context.chain.GaugeSingleRecipientGauge.add(event.params.gauge);
}
);

indexer.onEvent(
  { contract: "SingleRecipientGaugeV1Factory", event: "SingleRecipientGaugeCreated" },
  async ({ event, context }) => {
  await handleSingleRecipientGaugeCreated(event, context);
}
);

// ================================================================
// 6. SingleRecipientGaugeV2Factory — SingleRecipientGaugeV2Created
// ================================================================

indexer.contractRegister(
  { contract: "SingleRecipientGaugeV2Factory", event: "SingleRecipientGaugeV2Created" },
  async ({ event, context }) => {
  context.chain.GaugeSingleRecipientGauge.add(event.params.gauge);
}
);

indexer.onEvent(
  { contract: "SingleRecipientGaugeV2Factory", event: "SingleRecipientGaugeV2Created" },
  async ({ event, context }) => {
  await handleSingleRecipientGaugeCreated(event, context);
}
);

// ================================================================
// 7. ArbitrumRootGaugeV1Factory — ArbitrumRootGaugeCreated
// ================================================================

indexer.contractRegister(
  { contract: "ArbitrumRootGaugeV1Factory", event: "ArbitrumRootGaugeCreated" },
  async ({ event, context }) => {
  context.chain.GaugeRootGauge.add(event.params.gauge);
}
);

indexer.onEvent(
  { contract: "ArbitrumRootGaugeV1Factory", event: "ArbitrumRootGaugeCreated" },
  async ({ event, context }) => {
  await handleRootGaugeCreated(event, context, "Arbitrum");
}
);

// ================================================================
// 8. PolygonRootGaugeV1Factory — PolygonRootGaugeCreated
// ================================================================

indexer.contractRegister(
  { contract: "PolygonRootGaugeV1Factory", event: "PolygonRootGaugeCreated" },
  async ({ event, context }) => {
  context.chain.GaugeRootGauge.add(event.params.gauge);
}
);

indexer.onEvent(
  { contract: "PolygonRootGaugeV1Factory", event: "PolygonRootGaugeCreated" },
  async ({ event, context }) => {
  await handleRootGaugeCreated(event, context, "Polygon");
}
);

// ================================================================
// 9. OptimismRootGaugeV1Factory — OptimismRootGaugeCreated
// ================================================================

indexer.contractRegister(
  { contract: "OptimismRootGaugeV1Factory", event: "OptimismRootGaugeCreated" },
  async ({ event, context }) => {
  context.chain.GaugeRootGauge.add(event.params.gauge);
}
);

indexer.onEvent(
  { contract: "OptimismRootGaugeV1Factory", event: "OptimismRootGaugeCreated" },
  async ({ event, context }) => {
  await handleRootGaugeCreated(event, context, "Optimism");
}
);

// ================================================================
// 10. RootGaugeV2Factory — RootGaugeV2Created
// ================================================================

indexer.contractRegister(
  { contract: "RootGaugeV2Factory", event: "RootGaugeV2Created" },
  async ({ event, context }) => {
  context.chain.GaugeRootGauge.add(event.params.gauge);
}
);

indexer.onEvent(
  { contract: "RootGaugeV2Factory", event: "RootGaugeV2Created" },
  async ({ event, context }) => {
  const factoryAddress = event.srcAddress.toLowerCase();
  const chain = ROOT_GAUGE_V2_CHAIN_MAP[factoryAddress] ?? "Arbitrum";
  await handleRootGaugeCreated(event, context, chain);
}
);
