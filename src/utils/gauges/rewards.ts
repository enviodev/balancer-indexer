import BigDecimal from "bignumber.js";
import { ZERO_BD } from "../constants.js";
import { makeChainId } from "../entities.js";
import { scaleDown } from "../math.js";
import { getGaugeRewardData } from "../../effects/gauge.js";
import { getTokenMetadata } from "../../effects/erc20.js";

/**
 * Get or create a RewardToken entity. If the token doesn't exist in the gauge's
 * rewardTokensList, add it.
 */
export async function getOrCreateRewardToken(
  gaugeAddress: string,
  tokenAddress: string,
  chainId: number,
  context: any,
): Promise<any> {
  const gaugeId = makeChainId(chainId, gaugeAddress);
  const rewardTokenId = `${chainId}-${tokenAddress}-${gaugeAddress}`;

  let rewardToken = await context.RewardToken.get(rewardTokenId);
  if (!rewardToken) {
    // Get token metadata via RPC
    const meta = await context.effect(getTokenMetadata, { address: tokenAddress, chainId });

    rewardToken = {
      id: rewardTokenId,
      symbol: meta?.symbol ?? "",
      decimals: meta?.decimals ?? 18,
      gauge_id: gaugeId,
      rate: undefined,
      periodFinish: undefined,
      totalDeposited: ZERO_BD,
    };
    context.RewardToken.set(rewardToken);

    // Add to gauge's rewardTokensList
    const gauge = await context.LiquidityGauge.get(gaugeId);
    if (gauge) {
      const currentList = gauge.rewardTokensList ?? [];
      if (!currentList.includes(tokenAddress)) {
        context.LiquidityGauge.set({
          ...gauge,
          rewardTokensList: [...currentList, tokenAddress],
        });
      }
    }
  }

  return rewardToken;
}

/**
 * Fetch on-chain reward data for a token on a gauge and update the RewardToken entity.
 * Uses the getGaugeRewardData effect which calls reward_data(address) on the gauge contract.
 */
export async function setRewardData(
  gaugeAddress: string,
  tokenAddress: string,
  chainId: number,
  blockNumber: number,
  context: any,
): Promise<void> {
  const rewardToken = await getOrCreateRewardToken(gaugeAddress, tokenAddress, chainId, context);

  // Fetch reward data from chain - try the gauge contract directly
  // The effect handles the different ABI variants (L1 gauge, ChildChainStreamer, ChildChainV2)
  const rewardData = await context.effect(getGaugeRewardData, {
    address: gaugeAddress,
    tokenAddress,
    chainId,
    blockNumber,
  });

  if (rewardData) {
    context.RewardToken.set({
      ...rewardToken,
      rate: scaleDown(BigInt(rewardData.rate), 18),
      periodFinish: BigInt(rewardData.period_finish),
    });
  }
}
