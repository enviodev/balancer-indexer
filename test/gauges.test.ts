import { describe, it, expect } from "vitest";
import BigDecimal from "bignumber.js";
import { ZERO_BD } from "../src/utils/constants.js";
import { getOrCreateRewardToken, setRewardData } from "../src/utils/gauges/rewards.js";
import { scaleDown } from "../src/utils/math.js";

function createMockContext(entities: Record<string, Record<string, any>> = {}) {
  const store: Record<string, Record<string, any>> = {};
  for (const [key, val] of Object.entries(entities)) {
    store[key] = { ...val };
  }

  const makeEntityProxy = (entityName: string) => ({
    get: async (id: string) => store[entityName]?.[id] ?? null,
    set: (entity: any) => {
      if (!store[entityName]) store[entityName] = {};
      store[entityName]![entity.id] = entity;
    },
  });

  return {
    store,
    RewardToken: makeEntityProxy("RewardToken"),
    LiquidityGauge: makeEntityProxy("LiquidityGauge"),
    Token: makeEntityProxy("Token"),
    User: makeEntityProxy("User"),
    effect: async (_effect: any, input: any) => {
      // Mock effects
      if (_effect.name === "getTokenMetadata" || _effect?.config?.name === "getTokenMetadata") {
        return { name: "Mock Token", symbol: "MOCK", decimals: 18 };
      }
      if (_effect.name === "getGaugeRewardData" || _effect?.config?.name === "getGaugeRewardData") {
        return { rate: "1000000000000000000", period_finish: "1700000000" };
      }
      return null;
    },
  };
}

describe("getOrCreateRewardToken", () => {
  it("creates a new RewardToken if it doesn't exist", async () => {
    const ctx = createMockContext({
      LiquidityGauge: {
        "1-0xgauge": {
          id: "1-0xgauge",
          rewardTokensList: [],
          totalSupply: ZERO_BD,
        },
      },
    });

    const result = await getOrCreateRewardToken("0xgauge", "0xtoken", 1, ctx);

    expect(result.id).toBe("1-0xtoken-0xgauge");
    expect(result.gauge_id).toBe("1-0xgauge");
    expect(result.totalDeposited.eq(ZERO_BD)).toBe(true);

    // Verify it was stored
    const stored = await ctx.RewardToken.get("1-0xtoken-0xgauge");
    expect(stored).not.toBeNull();
  });

  it("returns existing RewardToken if it exists", async () => {
    const existingToken = {
      id: "1-0xtoken-0xgauge",
      symbol: "BAL",
      decimals: 18,
      gauge_id: "1-0xgauge",
      rate: new BigDecimal("5"),
      periodFinish: 1700000000n,
      totalDeposited: new BigDecimal("100"),
    };

    const ctx = createMockContext({
      RewardToken: { "1-0xtoken-0xgauge": existingToken },
    });

    const result = await getOrCreateRewardToken("0xgauge", "0xtoken", 1, ctx);
    expect(result.symbol).toBe("BAL");
    expect(result.totalDeposited.eq(new BigDecimal("100"))).toBe(true);
  });

  it("adds token to gauge's rewardTokensList", async () => {
    const ctx = createMockContext({
      LiquidityGauge: {
        "1-0xgauge": {
          id: "1-0xgauge",
          rewardTokensList: [],
          totalSupply: ZERO_BD,
        },
      },
    });

    await getOrCreateRewardToken("0xgauge", "0xtoken", 1, ctx);

    const gauge = await ctx.LiquidityGauge.get("1-0xgauge");
    expect(gauge!.rewardTokensList).toContain("0xtoken");
  });

  it("does not duplicate token in rewardTokensList", async () => {
    const ctx = createMockContext({
      LiquidityGauge: {
        "1-0xgauge": {
          id: "1-0xgauge",
          rewardTokensList: ["0xtoken"],
          totalSupply: ZERO_BD,
        },
      },
      RewardToken: {
        "1-0xtoken-0xgauge": {
          id: "1-0xtoken-0xgauge",
          symbol: "BAL",
          decimals: 18,
          gauge_id: "1-0xgauge",
          totalDeposited: ZERO_BD,
        },
      },
    });

    await getOrCreateRewardToken("0xgauge", "0xtoken", 1, ctx);

    const gauge = await ctx.LiquidityGauge.get("1-0xgauge");
    expect(gauge!.rewardTokensList.filter((t: string) => t === "0xtoken").length).toBe(1);
  });
});

describe("setRewardData", () => {
  it("updates RewardToken with on-chain data", async () => {
    const ctx = createMockContext({
      LiquidityGauge: {
        "1-0xgauge": {
          id: "1-0xgauge",
          rewardTokensList: ["0xtoken"],
          totalSupply: ZERO_BD,
        },
      },
      RewardToken: {
        "1-0xtoken-0xgauge": {
          id: "1-0xtoken-0xgauge",
          symbol: "BAL",
          decimals: 18,
          gauge_id: "1-0xgauge",
          rate: undefined,
          periodFinish: undefined,
          totalDeposited: ZERO_BD,
        },
      },
    });

    await setRewardData("0xgauge", "0xtoken", 1, ctx);

    const updated = await ctx.RewardToken.get("1-0xtoken-0xgauge");
    expect(updated).not.toBeNull();
    // The mock effect returns rate: "1000000000000000000" (1e18) → scaleDown 18 = 1.0
    expect(updated!.rate.eq(scaleDown(1000000000000000000n, 18))).toBe(true);
    expect(updated!.periodFinish).toBe(1700000000n);
  });
});

describe("gauge share ID format", () => {
  it("follows chainId-user-gauge format", () => {
    const shareId = `${1}-${"0xuser"}-${"0xgauge"}`;
    expect(shareId).toBe("1-0xuser-0xgauge");
  });
});

describe("scaleDown for gauge values", () => {
  it("scales BPT (18 decimals) correctly", () => {
    const result = scaleDown(1000000000000000000n, 18);
    expect(result.eq(new BigDecimal("1"))).toBe(true);
  });

  it("handles veBAL lock amounts", () => {
    const lockAmount = 50000000000000000000000n; // 50,000 veBAL
    const result = scaleDown(lockAmount, 18);
    expect(result.eq(new BigDecimal("50000"))).toBe(true);
  });
});
