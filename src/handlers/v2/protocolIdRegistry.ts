import { indexer } from "envio";
import { makeChainId } from "../../utils/entities.js";

indexer.onEvent(
  { contract: "V2ProtocolIdRegistry", event: "ProtocolIdRegistered" },
  async ({ event, context }) => {
  const chainId = event.chainId;
  const protocolId = Number(event.params.protocolId);
  const id = `${chainId}-${protocolId}`;

  context.V2ProtocolIdData.set({
    id,
    name: event.params.name,
  });
}
);

indexer.onEvent(
  { contract: "V2ProtocolIdRegistry", event: "ProtocolIdRenamed" },
  async ({ event, context }) => {
  const chainId = event.chainId;
  const protocolId = Number(event.params.protocolId);
  const id = `${chainId}-${protocolId}`;

  const existing = await context.V2ProtocolIdData.get(id);
  if (existing) {
    context.V2ProtocolIdData.set({
      ...existing,
      name: event.params.name,
    });
  } else {
    context.V2ProtocolIdData.set({
      id,
      name: event.params.name,
    });
  }
}
);
