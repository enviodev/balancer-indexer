import { V3ReClammPool } from "generated";
import { makeChainId } from "../../utils/entities.js";

V3ReClammPool.CenterednessMarginUpdated.handler(async ({ event, context }) => {
  const paramsId = makeChainId(event.chainId, event.srcAddress);
  const params = await context.V3ReClammParams.get(paramsId);
  if (!params) return;
  context.V3ReClammParams.set({ ...params, centerednessMargin: event.params.centerednessMargin });
});

V3ReClammPool.LastTimestampUpdated.handler(async ({ event, context }) => {
  const paramsId = makeChainId(event.chainId, event.srcAddress);
  const params = await context.V3ReClammParams.get(paramsId);
  if (!params) return;
  context.V3ReClammParams.set({ ...params, lastTimestamp: BigInt(event.params.lastTimestamp) });
});

V3ReClammPool.VirtualBalancesUpdated.handler(async ({ event, context }) => {
  const paramsId = makeChainId(event.chainId, event.srcAddress);
  const params = await context.V3ReClammParams.get(paramsId);
  if (!params) return;
  context.V3ReClammParams.set({
    ...params,
    lastVirtualBalances: [event.params.virtualBalanceA, event.params.virtualBalanceB],
  });
});

V3ReClammPool.DailyPriceShiftExponentUpdated.handler(async ({ event, context }) => {
  const paramsId = makeChainId(event.chainId, event.srcAddress);
  const params = await context.V3ReClammParams.get(paramsId);
  if (!params) return;
  context.V3ReClammParams.set({
    ...params,
    dailyPriceShiftExponent: event.params.dailyPriceShiftExponent,
    dailyPriceShiftBase: event.params.dailyPriceShiftBase,
  });
});

V3ReClammPool.PriceRatioStateUpdated.handler(async ({ event, context }) => {
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
});
