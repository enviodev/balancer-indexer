import { V2EventEmitter } from "generated";
import { setRewardData } from "../../utils/gauges/rewards.js";

// The EventEmitter's LogArgument event is used for:
// 1. FX pool oracle updates (V2 subgraph)
// 2. Gauge preferential gauge setting (gauges subgraph)
// 3. Gauge rewards data updates (gauges subgraph)
// 4. GaugeInjector registration (gauges subgraph)
//
// Event: LogArgument(address indexed pool, bytes32 indexed topic, bytes data, uint256 logIndex)
// In the gauges subgraph, params are referred to as: message (pool), identifier (topic), value (logIndex)
//
// Identifiers (keccak256 of function name):
// - setPreferentialGauge: 0x88aea7780a038b8536bb116545f59b8a089101d5e526639d3c54885508ce50e2
// - setChildChainGaugeRewardsData: 0x94e5a0dff823a8fce9322f522279854e2370a9ef309a74a7a86367e2a2872b2d
// - setGaugeInjector: 0x109783b117ecbf8caf4e937abaf494b965e5d90c4d1b010b27eb2a3be80eaf21

const SET_PREFERENTIAL_GAUGE = "0x88aea7780a038b8536bb116545f59b8a089101d5e526639d3c54885508ce50e2";
const SET_GAUGE_INJECTOR = "0x109783b117ecbf8caf4e937abaf494b965e5d90c4d1b010b27eb2a3be80eaf21";
const SET_GAUGE_REWARDS_DATA = "0x94e5a0dff823a8fce9322f522279854e2370a9ef309a74a7a86367e2a2872b2d";

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
  }
});
