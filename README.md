# Balancer Indexer

Balancer Protocol Unified Indexer. Built with [Envio HyperIndex](https://docs.envio.dev).

## Chains

| Network | Chain ID |
|---|---|
| Ethereum Mainnet | 1 |
| Gnosis | 100 |
| Sepolia | 11155111 |
| Arbitrum | 42161 |
| Base | 8453 |
| Optimism | 10 |
| Avalanche | 43114 |
| Sonic | 146 |
| Polygon | 137 |
| Polygon zkEVM | 1101 |
| Hyperliquid | 999 |
| Plasma | 9745 |
| Monad | 143 |
| (chain 196) | 196 |

## Contracts

- **`V3Vault`**: `PoolRegistered`, `Swap`, `LiquidityAdded`, `LiquidityRemoved`, `LiquidityAddedToBuffer`, `LiquidityRemovedFromBuffer`, `BufferSharesMinted`, `BufferSharesBurned`, `Wrap`, `Unwrap`, `SwapFeePercentageChanged`, `PoolRecoveryModeStateChanged`, `PoolPausedStateChanged`, `ProtocolFeeControllerChanged`
- **`V3ProtocolFeeController`**: `GlobalProtocolSwapFeePercentageChanged`, `GlobalProtocolYieldFeePercentageChanged`, `PoolCreatorSwapFeePercentageChanged`, `PoolCreatorYieldFeePercentageChanged`, `ProtocolSwapFeePercentageChanged`, `ProtocolYieldFeePercentageChanged`, `ProtocolSwapFeeCollected`, `ProtocolYieldFeeCollected`, `ProtocolFeesWithdrawn`
- **`V3BPT`**: `Transfer`
- **`V3WeightedPoolFactory`**: `PoolCreated`
- **`V3WeightedPoolV2Factory`**: `PoolCreated`
- **`V3StablePoolFactory`**: `PoolCreated`
- **`V3StablePoolV2Factory`**: `PoolCreated`
- **`V3StablePoolV3Factory`**: `PoolCreated`
- **`V3Gyro2CLPPoolFactory`**: `PoolCreated`
- **`V3GyroECLPPoolFactory`**: `PoolCreated`
- **`V3QuantAMMWeightedPoolFactory`**: `PoolCreated`
- **`V3LBPoolFactory`**: `PoolCreated`
- **`V3LBPoolV2Factory`**: `PoolCreated`
- **`V3LBPoolV3Factory`**: `PoolCreated`
- **`V3FixedPriceLBPoolFactory`**: `PoolCreated`
- **`V3ReClammPoolFactory`**: `PoolCreated`
- **`V3ReClammPoolV2Factory`**: `PoolCreated`
- **`V3StableSurgeHook`**: `StableSurgeHookRegistered`
- **`V3StableSurgeHookV2`**: `StableSurgeHookRegistered`
- **`V3StableSurgeHookV3`**: `StableSurgeHookRegistered`
- **`V3ReClammPool`**: `CenterednessMarginUpdated`, `LastTimestampUpdated`, `VirtualBalancesUpdated`, `DailyPriceShiftExponentUpdated`, `PriceRatioStateUpdated`
- **`V2Vault`**: `Swap`, `PoolBalanceChanged`, `PoolBalanceManaged`, `InternalBalanceChanged`
- **`V2EventEmitter`**: `LogArgument`
- **`V2PoolFactory`**: `PoolCreated`
- **`V2Pool`**: `Transfer`, `SwapFeePercentageChanged`, `PausedStateChanged`, `RecoveryModeStateChanged`, `ProtocolFeePercentageCacheUpdated`, `AmpUpdateStarted`, `AmpUpdateStopped`, `SwapEnabledSet`, `GradualWeightUpdateScheduled`, `OracleEnabledChanged`, `TargetsSet`, `PausedLocally`, `UnpausedLocally`, `PriceRateProviderSet`, `PriceRateCacheUpdated`, `TokenRateProviderSet`, `TokenRateCacheUpdated`, `MustAllowlistLPsSet`, `JoinExitEnabledSet`, `CircuitBreakerSet`, `TokenAdded`, `TokenRemoved`, `ManagementAumFeeCollected`, `ManagementFeePercentageChanged`, `ManagementAumFeePercentageChanged`, `GradualSwapFeeUpdateScheduled`, `ParametersSet`
- **`V2ProtocolIdRegistry`**: `ProtocolIdRegistered`, `ProtocolIdRenamed`
- **`GaugeController`**: `AddType`, `NewGauge`, `VoteForGauge`
- **`VotingEscrowContract`**: `Deposit`, `Withdraw`, `Supply`
- **`OmniVotingEscrow`**: `UserBalToChain`
- **`OmniVotingEscrowChild`**: `UserBalFromChain`
- **`GaugeAuthorizerAdaptor`**: `ActionPerformed`
- **`GaugeLiquidityV1Factory`**: `GaugeCreated`
- **`GaugeLiquidityV2Factory`**: `LiquidityGaugeV2Created`
- **`ChildChainGaugeV1Factory`**: `RewardsOnlyGaugeCreated`
- **`ChildChainGaugeV2Factory`**: `ChildChainGaugeV2Created`
- **`SingleRecipientGaugeV1Factory`**: `SingleRecipientGaugeCreated`
- **`SingleRecipientGaugeV2Factory`**: `SingleRecipientGaugeV2Created`
- **`ArbitrumRootGaugeV1Factory`**: `ArbitrumRootGaugeCreated`
- **`PolygonRootGaugeV1Factory`**: `PolygonRootGaugeCreated`
- **`OptimismRootGaugeV1Factory`**: `OptimismRootGaugeCreated`
- **`RootGaugeV2Factory`**: `RootGaugeV2Created`
- **`GaugeLiquidityGauge`**: `GaugeLiquidityGaugeTransfer`, `RelativeWeightCapChanged`
- **`GaugeRewardsOnlyGauge`**: `GaugeRewardsOnlyTransfer`
- **`GaugeChildChainStreamer`**: `RewardDurationUpdated`
- **`GaugeRootGauge`**: `RootGaugeRelativeWeightCapChanged`
- **`GaugeSingleRecipientGauge`**: `SingleRecipientRelativeWeightCapChanged`
- **`GaugeInjectorContract`**: `EmissionsInjection`
- **`ReliquaryContract`**: `LogPoolAddition`, `LogPoolModified`, `LogSetEmissionCurve`, `Deposit`, `Withdraw`, `EmergencyWithdraw`, `Harvest`, `LevelChanged`, `Split`, `Shift`, `Merge`, `Transfer`
- **`ReliquaryEmissionCurve`**: `LogRate`
- **`SonicStakingContract`**: `Delegated`, `Deposited`, `Donated`, `Undelegated`, `OperatorClawBackInitiated`, `OperatorClawBackExecuted`, `RewardsClaimed`

## Schema entities (82)

`User`, `Token`, `V3Vault`, `V3Pool`, `V3Hook`, `V3HookConfig`, `V3LiquidityManagement`, `V3PoolToken`, `V3RateProvider`, `V3Buffer`, `V3BufferShare`, `V3Swap`, `V3AddRemove`, `V3PoolShare`, `V3PoolSnapshot`, `V3Factory`, `V3PoolTypeInfo`, `V3WeightedParams`, `V3StableParams`, `V3StableSurgeParams`, `V3Gyro2Params`, `V3GyroEParams`, `V3QuantAMMWeightedParams`, `V3QuantAMMWeightedDetail`, `V3LBPParams`, `V3FixedLBPParams`, `V3ReClammParams`, `V2Balancer`, `V2Pool`, `V2PoolContract`, `V2PoolToken`, `V2PriceRateProvider`, `V2CircuitBreaker`, `V2PoolShare`, `V2UserInternalBalance`, `V2GradualWeightUpdate`, `V2AmpUpdate`, `V2SwapFeeUpdate`, `V2Swap`, `V2JoinExit`, `V2LatestPrice`, `V2PoolHistoricalLiquidity`, `V2TokenPrice`, `V2ManagementOperation`, `V2PoolSnapshot`, `V2TokenSnapshot`, `V2TradePair`, `V2TradePairSnapshot`, `V2BalancerSnapshot`, `V2ProtocolIdData`, `V2FXOracle`, `V2TokenData`, `VotingEscrow`, `OmniVotingEscrowLock`, `VotingEscrowLock`, `LockSnapshot`, `GaugeFactory`, `LiquidityGauge`, `RootGauge`, `SingleRecipientGauge`, `Gauge`, `GaugePool`, `RewardToken`, `GaugeShare`, `GaugeType`, `GaugeVote`, `GaugeLookup`, `GaugeInjector`, `Reliquary`, `ReliquaryEmissionCurve`, `ReliquaryPool`, `ReliquaryPoolLevel`, `ReliquaryDailyPoolSnapshot`, `Relic`, `ReliquaryHarvest`, `ReliquaryUser`, `ReliquaryDailyRelicSnapshot`, `ReliquaryRewarder`, `ReliquaryRewarderEmission`, `SonicStaking`, `StsValidator`, `SonicStakingSnapshot`

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
