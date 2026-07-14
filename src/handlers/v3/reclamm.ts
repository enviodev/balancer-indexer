import { indexer } from "envio";
import { makeChainId } from "../../utils/entities.js";

indexer.onEvent(
  { contract: "V3ReClammPool", event: "CenterednessMarginUpdated" },
  async ({ event, context }) => {
  const paramsId = makeChainId(event.chainId, event.srcAddress);
  const params = await context.V3ReClammParams.get(paramsId);
  if (!params) return;
  context.V3ReClammParams.set({ ...params, centerednessMargin: event.params.centerednessMargin });
}
);

indexer.onEvent(
  { contract: "V3ReClammPool", event: "LastTimestampUpdated" },
  async ({ event, context }) => {
  const paramsId = makeChainId(event.chainId, event.srcAddress);
  const params = await context.V3ReClammParams.get(paramsId);
  if (!params) return;
  context.V3ReClammParams.set({ ...params, lastTimestamp: BigInt(event.params.lastTimestamp) });
}
);

indexer.onEvent(
  { contract: "V3ReClammPool", event: "VirtualBalancesUpdated" },
  async ({ event, context }) => {
  const paramsId = makeChainId(event.chainId, event.srcAddress);
  const params = await context.V3ReClammParams.get(paramsId);
  if (!params) return;
  context.V3ReClammParams.set({
    ...params,
    lastVirtualBalances: [event.params.virtualBalanceA, event.params.virtualBalanceB],
  });
}
);

indexer.onEvent(
  { contract: "V3ReClammPool", event: "DailyPriceShiftExponentUpdated" },
  async ({ event, context }) => {
  const paramsId = makeChainId(event.chainId, event.srcAddress);
  const params = await context.V3ReClammParams.get(paramsId);
  if (!params) return;
  context.V3ReClammParams.set({
    ...params,
    dailyPriceShiftExponent: event.params.dailyPriceShiftExponent,
    dailyPriceShiftBase: event.params.dailyPriceShiftBase,
  });
}
);

indexer.onEvent(
  { contract: "V3ReClammPool", event: "PriceRatioStateUpdated" },
  async ({ event, context }) => {
  const paramsId = makeChainId(event.chainId, event.srcAddress);
  const params = await context.V3ReClammParams.get(paramsId);
  if (!params) return;
  context.V3ReClammParams.set({
    ...params,
    priceRatioUpdateStartTime: event.params.priceRatioUpdateStartTime,
    priceRatioUpdateEndTime: event.params.priceRatioUpdateEndTime,
    startFourthRootPriceRatio: event.params.startFourthRootPriceRatio,
    endFourthRootPriceRatio: event.params.endFourthRootPriceRatio,
  });
}
);
