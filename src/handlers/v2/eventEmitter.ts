import { V2EventEmitter } from "generated";
import BigDecimal from "bignumber.js";
import { makeChainId } from "../../utils/entities.js";
import { setRewardData } from "../../utils/gauges/rewards.js";

// The EventEmitter's LogArgument event is used for:
// 1. V2-specific: setSwapEnabled, setLatestUSDPrice, setPoolType
// 2. Gauge preferential gauge setting (gauges subgraph)
// 3. Gauge rewards data updates (gauges subgraph)
// 4. GaugeInjector registration (gauges subgraph)
//
// Event: LogArgument(address indexed pool, bytes32 indexed topic, bytes data, uint256 logIndex)
// In the V2 subgraph: message (pool), identifier (topic), value (logIndex)
//
// V2 identifiers (keccak256 of function name):
// - setSwapEnabled: 0xe84220e19c54dd2a96deb4cb59ea58e10e36ae2e5c0887f3af0a1ac8e04b0e29
// - setLatestUSDPrice: 0x205869a4266a1bbcc5e2e5255221a32636b162e29887138cc0a8ba5141d05c62
// - setPoolType: 0x23462a935a3b72f9098a1e3b21d6506d4a63139cb3b4c372a5df6fdde64cf80d
//
// Gauge identifiers:
// - setPreferentialGauge: 0x88aea7780a038b8536bb116545f59b8a089101d5e526639d3c54885508ce50e2
// - setChildChainGaugeRewardsData: 0x94e5a0dff823a8fce9322f522279854e2370a9ef309a74a7a86367e2a2872b2d
// - setGaugeInjector: 0x109783b117ecbf8caf4e937abaf494b965e5d90c4d1b010b27eb2a3be80eaf21

// V2 identifiers
const SET_SWAP_ENABLED = "0xe84220e19c54dd2a96deb4cb59ea58e10e36ae2e5c0887f3af0a1ac8e04b0e29";
const SET_LATEST_USD_PRICE = "0x205869a4266a1bbcc5e2e5255221a32636b162e29887138cc0a8ba5141d05c62";
const SET_POOL_TYPE = "0x23462a935a3b72f9098a1e3b21d6506d4a63139cb3b4c372a5df6fdde64cf80d";

// Gauge identifiers
const SET_PREFERENTIAL_GAUGE = "0x88aea7780a038b8536bb116545f59b8a089101d5e526639d3c54885508ce50e2";
const SET_GAUGE_INJECTOR = "0x109783b117ecbf8caf4e937abaf494b965e5d90c4d1b010b27eb2a3be80eaf21";
const SET_GAUGE_REWARDS_DATA = "0x94e5a0dff823a8fce9322f522279854e2370a9ef309a74a7a86367e2a2872b2d";

// Pool type index lookup (must match subgraph's poolTypes array order)
const POOL_TYPES = [
  "Weighted", "Stable", "MetaStable", "Element", "LiquidityBootstrapping",
  "Investment", "Managed", "KassandraManaged", "StablePhantom", "ComposableStable",
  "HighAmpComposableStable", "AaveLinear", "ERC4626Linear", "EulerLinear",
  "GearboxLinear", "MidasLinear", "ReaperLinear", "SiloLinear", "YearnLinear",
  "Gyro2", "Gyro3", "GyroE", "FX",
];

// contractRegister: register GaugeInjectorContract dynamic contracts
V2EventEmitter.LogArgument.contractRegister(({ event, context }) => {
  if (event.params.topic === SET_GAUGE_INJECTOR) {
    const injectorAddress = event.params.pool.toLowerCase();
    context.addGaugeInjectorContract(injectorAddress as `0x${string}`);
  }
});

V2EventEmitter.LogArgument.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const identifier = event.params.topic;

  if (identifier === SET_PREFERENTIAL_GAUGE) {
    // pool param = gauge address, logIndex param = 0 to unset, non-zero to set
    const gaugeAddress = event.params.pool.toLowerCase();
    const gaugeId = `${chainId}-${gaugeAddress}`;
    const gauge = await context.LiquidityGauge.get(gaugeId);
    if (!gauge) return;

    const isPreferential = event.params.logIndex !== 0n;

    context.LiquidityGauge.set({
      ...gauge,
      isPreferentialGauge: isPreferential,
    });

    // Update GaugePool's preferentialGauge
    if (gauge.pool_id) {
      const pool = await context.GaugePool.get(gauge.pool_id);
      if (pool) {
        context.GaugePool.set({
          ...pool,
          preferentialGauge_id: isPreferential ? gaugeId : undefined,
        });
      }
    }
  } else if (identifier === SET_GAUGE_INJECTOR) {
    // pool param = injector address
    const injectorAddress = event.params.pool.toLowerCase();
    const injectorId = `${chainId}-${injectorAddress}`;
    const existing = await context.GaugeInjector.get(injectorId);
    if (!existing) {
      context.GaugeInjector.set({ id: injectorId });
    }
  } else if (identifier === SET_GAUGE_REWARDS_DATA) {
    // pool param = gauge address
    const gaugeAddress = event.params.pool.toLowerCase();
    const gaugeId = `${chainId}-${gaugeAddress}`;
    const gauge = await context.LiquidityGauge.get(gaugeId);
    if (!gauge) return;

    const rewardTokensList = gauge.rewardTokensList ?? [];
    for (const tokenAddress of rewardTokensList) {
      await setRewardData(gaugeAddress, tokenAddress, chainId, context);
    }
  } else if (identifier === SET_SWAP_ENABLED) {
    // pool param = pool address (in V2 subgraph: poolId hex string)
    // logIndex param = 0 to disable swap, non-zero to enable
    const poolAddress = event.params.pool.toLowerCase();
    const poolId = makeChainId(chainId, poolAddress);
    const pool = await context.V2Pool.get(poolId);
    if (!pool) return;

    const enabled = event.params.logIndex !== 0n;
    context.V2Pool.set({
      ...pool,
      swapEnabledCurationSignal: enabled,
      swapEnabled: enabled ? !(pool.isPaused ?? false) && (pool.swapEnabledInternal ?? true) : false,
    });
  } else if (identifier === SET_LATEST_USD_PRICE) {
    // pool param = token address
    // logIndex param = price in cents of USD (1 = $0.01)
    const tokenAddress = event.params.pool.toLowerCase();
    const tokenId = makeChainId(chainId, tokenAddress);
    const token = await context.Token.get(tokenId);
    if (!token) return;

    const priceInCents = new BigDecimal(event.params.logIndex.toString());
    const base = new BigDecimal(100);
    context.Token.set({
      ...token,
      latestUSDPrice: priceInCents.div(base),
    });
  } else if (identifier === SET_POOL_TYPE) {
    // pool param = pool address
    // logIndex param = pool type index in POOL_TYPES array
    const poolAddress = event.params.pool.toLowerCase();
    const poolId = makeChainId(chainId, poolAddress);
    const pool = await context.V2Pool.get(poolId);
    if (!pool) return;

    const typeIndex = Number(event.params.logIndex);
    if (typeIndex >= 0 && typeIndex < POOL_TYPES.length) {
      context.V2Pool.set({
        ...pool,
        poolType: POOL_TYPES[typeIndex],
      });
    }
  }
});
