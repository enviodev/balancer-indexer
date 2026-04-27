# Balancer Indexer

A unified, multichain Balancer Protocol indexer built with [Envio HyperIndex](https://docs.envio.dev). Tracks Balancer V2 and V3 pools, swaps, liquidity events, gauges, and voting escrow across 14 chains in a single deployment.

## Chains (14)

`1`, `10`, `56`, `100`, `137`, `143`, `146`, `196`, `999`, `1101`, `8453`, `9745`, `11155111`, `42161`, `43114`

## What it indexes

### V3
- `V3Vault`: pool registration, swaps, liquidity add/remove, buffer shares, recovery mode, paused state, swap fee changes
- `V3ProtocolFeeController`: protocol-level swap and yield fee changes, fee collection, withdrawals
- `V3BPT`: pool token transfers (registered dynamically when pools are created)
- V3 Pool Factories: `V3WeightedPoolFactory`, `V3WeightedPoolV2Factory`, `V3StablePoolFactory` (V1/V2/V3), `V3Gyro2CLPPoolFactory`, `V3GyroECLPPoolFactory`, `V3QuantAMMWeightedPoolFactory`, `V3LBPoolFactory` (V1/V2/V3), `V3FixedPriceLBPoolFactory`, `V3ReClammPoolFactory` (V1/V2)
- V3 Hooks: `V3StableSurgeHook` (V1/V2/V3), `V3ReClammPool`

### V2
- `V2Vault`, `V2EventEmitter`, `V2PoolFactory`, `V2Pool`, `V2ProtocolIdRegistry`

### Gauges and voting escrow
- `GaugeController`, `VotingEscrowContract`, `OmniVotingEscrow`, `OmniVotingEscrowChild`, `GaugeAuthorizerAdaptor`
- Gauge factories (V1/V2 liquidity, child-chain V1/V2, single-recipient V1/V2, Arbitrum/Polygon/Optimism root V1, V2 root)
- Gauge implementations (`GaugeLiquidityGauge`, `GaugeRewardsOnlyGauge`, `GaugeChildChainStreamer`, `GaugeRootGauge`, `GaugeSingleRecipientGauge`, `GaugeInjectorContract`)

### Other
- `ReliquaryContract`, `ReliquaryEmissionCurve`, `SonicStakingContract`

## Schema

82 GraphQL entities including `User`, `Token`, `V3Vault`, `V3Pool`, `V3Swap`, `V3PoolSnapshot`, `V3Buffer`, `V2Pool`, plus per-pool-type parameter entities (`V3WeightedParams`, `V3StableSurgeParams`, `V3GyroEParams`, `V3QuantAMMWeightedParams`, etc.).

## Run locally

```bash
pnpm install
pnpm dev
```

GraphQL playground at [http://localhost:8080](http://localhost:8080) (local password: `testing`).

## Generate from `config.yaml` or `schema.graphql`

```bash
pnpm codegen
```

## Pre-requisites

- [Node.js v22+ (v24 recommended)](https://nodejs.org/en/download/current)
- [pnpm](https://pnpm.io/installation)
- [Docker](https://www.docker.com/products/docker-desktop/) or [Podman](https://podman.io/)

## Resources

- [Envio docs](https://docs.envio.dev)
- [HyperIndex overview](https://docs.envio.dev/docs/HyperIndex/overview)
- [Discord](https://discord.gg/envio)
