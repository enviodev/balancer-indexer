import { describe, it, expect } from "vitest";
import BigDecimal from "bignumber.js";
import {
  isPricingAsset,
  isUSDStable,
  getLatestPriceId,
  getPreferentialPricingAsset,
  hasVirtualSupply,
  valueInUSD,
  swapValueInUSD,
} from "../src/utils/v2/pricing.js";

// ================================
// Pure Function Tests
// ================================

describe("isPricingAsset", () => {
  it("returns true for WETH on Ethereum", () => {
    expect(isPricingAsset(1, "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2")).toBe(true);
  });

  it("returns true for USDC on Ethereum", () => {
    expect(isPricingAsset(1, "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48")).toBe(true);
  });

  it("returns true case-insensitive", () => {
    expect(isPricingAsset(1, "0xC02AAA39B223FE8D0A0E5C4F27EAD9083C756CC2")).toBe(true);
  });

  it("returns false for unknown token", () => {
    expect(isPricingAsset(1, "0x0000000000000000000000000000000000000001")).toBe(false);
  });

  it("returns false for unknown chain", () => {
    expect(isPricingAsset(999, "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2")).toBe(false);
  });

  it("returns true for WMATIC on Polygon", () => {
    expect(isPricingAsset(137, "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270")).toBe(true);
  });

  it("returns true for WETH on Arbitrum", () => {
    expect(isPricingAsset(42161, "0x82af49447d8a07e3bd95bd0d56f35241523fbab1")).toBe(true);
  });
});

describe("isUSDStable", () => {
  it("returns true for USDC on Ethereum", () => {
    expect(isUSDStable(1, "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48")).toBe(true);
  });

  it("returns true for DAI on Ethereum", () => {
    expect(isUSDStable(1, "0x6b175474e89094c44da98b954eedeac495271d0f")).toBe(true);
  });

  it("returns true for USDT on Ethereum", () => {
    expect(isUSDStable(1, "0xdac17f958d2ee523a2206206994597c13d831ec7")).toBe(true);
  });

  it("returns false for WETH (not a stablecoin)", () => {
    expect(isUSDStable(1, "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2")).toBe(false);
  });

  it("returns true for WXDAI on Gnosis", () => {
    expect(isUSDStable(100, "0xe91d153e0b41518a2ce8dd3d7944fa863463a97d")).toBe(true);
  });

  it("returns false for unknown chain", () => {
    expect(isUSDStable(999, "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48")).toBe(false);
  });
});

describe("getLatestPriceId", () => {
  it("returns chainId-token-pricingAsset format", () => {
    expect(getLatestPriceId(1, "0xabc", "0xdef")).toBe("1-0xabc-0xdef");
  });

  it("includes chainId in the ID", () => {
    const id1 = getLatestPriceId(1, "0xabc", "0xdef");
    const id2 = getLatestPriceId(137, "0xabc", "0xdef");
    expect(id1).not.toBe(id2);
  });
});

describe("getPreferentialPricingAsset", () => {
  it("returns the first pricing asset found (by priority)", () => {
    // On Ethereum, WETH has highest priority
    const result = getPreferentialPricingAsset(1, [
      "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC
      "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // WETH
    ]);
    // WETH comes first in PRICING_ASSETS for chain 1
    expect(result).toBe("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2");
  });

  it("returns null if no pricing assets found", () => {
    const result = getPreferentialPricingAsset(1, [
      "0x0000000000000000000000000000000000000001",
      "0x0000000000000000000000000000000000000002",
    ]);
    expect(result).toBeNull();
  });

  it("returns null for unknown chain", () => {
    const result = getPreferentialPricingAsset(999, [
      "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    ]);
    expect(result).toBeNull();
  });

  it("returns single matching token", () => {
    const result = getPreferentialPricingAsset(1, [
      "0x0000000000000000000000000000000000000001",
      "0xba100000625a3754423978a60c9317c58a424e3d", // BAL
    ]);
    expect(result).toBe("0xba100000625a3754423978a60c9317c58a424e3d");
  });
});

describe("hasVirtualSupply", () => {
  it("returns true for ComposableStable", () => {
    expect(hasVirtualSupply("ComposableStable")).toBe(true);
  });

  it("returns true for StablePhantom", () => {
    expect(hasVirtualSupply("StablePhantom")).toBe(true);
  });

  it("returns true for AaveLinear", () => {
    expect(hasVirtualSupply("AaveLinear")).toBe(true);
  });

  it("returns true for ERC4626Linear", () => {
    expect(hasVirtualSupply("ERC4626Linear")).toBe(true);
  });

  it("returns false for Weighted", () => {
    expect(hasVirtualSupply("Weighted")).toBe(false);
  });

  it("returns false for Stable", () => {
    expect(hasVirtualSupply("Stable")).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(hasVirtualSupply(undefined)).toBe(false);
  });
});

// ================================
// Async Function Tests (with mock context)
// ================================

function createMockContext(entities: Record<string, Record<string, any>> = {}) {
  const store: Record<string, Record<string, any>> = { ...entities };

  return {
    Token: {
      get: async (id: string) => store["Token"]?.[id] ?? null,
      set: (entity: any) => {
        if (!store["Token"]) store["Token"] = {};
        store["Token"]![entity.id] = entity;
      },
    },
    V2LatestPrice: {
      get: async (id: string) => store["V2LatestPrice"]?.[id] ?? null,
      set: (entity: any) => {
        if (!store["V2LatestPrice"]) store["V2LatestPrice"] = {};
        store["V2LatestPrice"]![entity.id] = entity;
      },
    },
  };
}

describe("valueInUSD", () => {
  it("returns amount directly for USD stablecoins", async () => {
    const ctx = createMockContext();
    const amount = new BigDecimal("1000");
    const usdc = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
    const result = await valueInUSD(amount, usdc, 1, ctx);
    expect(result.eq(amount)).toBe(true);
  });

  it("multiplies by latestUSDPrice for non-stables", async () => {
    const weth = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
    const ctx = createMockContext({
      Token: {
        [`1-${weth}`]: {
          id: `1-${weth}`,
          latestUSDPrice: new BigDecimal("2000"),
        },
      },
    });
    const amount = new BigDecimal("5");
    const result = await valueInUSD(amount, weth, 1, ctx);
    expect(result.eq(new BigDecimal("10000"))).toBe(true);
  });

  it("returns ZERO_BD if no price available", async () => {
    const ctx = createMockContext();
    const amount = new BigDecimal("100");
    const result = await valueInUSD(amount, "0x0000000000000000000000000000000000000001", 1, ctx);
    expect(result.eq(new BigDecimal(0))).toBe(true);
  });

  it("returns ZERO_BD if token exists but no latestUSDPrice", async () => {
    const token = "0x0000000000000000000000000000000000000001";
    const ctx = createMockContext({
      Token: {
        [`1-${token}`]: {
          id: `1-${token}`,
          latestUSDPrice: undefined,
        },
      },
    });
    const result = await valueInUSD(new BigDecimal("100"), token, 1, ctx);
    expect(result.eq(new BigDecimal(0))).toBe(true);
  });
});

describe("swapValueInUSD", () => {
  it("returns tokenOut amount when tokenOut is USD stable", async () => {
    const ctx = createMockContext();
    const usdc = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
    const weth = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
    const result = await swapValueInUSD(
      weth, new BigDecimal("1"),
      usdc, new BigDecimal("2000"),
      1, ctx,
    );
    expect(result.eq(new BigDecimal("2000"))).toBe(true);
  });

  it("returns tokenIn amount when tokenIn is USD stable", async () => {
    const ctx = createMockContext();
    const usdc = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
    const weth = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
    const result = await swapValueInUSD(
      usdc, new BigDecimal("2000"),
      weth, new BigDecimal("1"),
      1, ctx,
    );
    expect(result.eq(new BigDecimal("2000"))).toBe(true);
  });

  it("prefers tokenOut stable over tokenIn stable", async () => {
    const ctx = createMockContext();
    const usdc = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
    const dai = "0x6b175474e89094c44da98b954eedeac495271d0f";
    const result = await swapValueInUSD(
      dai, new BigDecimal("1000"),
      usdc, new BigDecimal("999"),
      1, ctx,
    );
    // tokenOut (USDC) is also stable, so it takes precedence
    expect(result.eq(new BigDecimal("999"))).toBe(true);
  });

  it("returns ZERO_BD when no pricing available", async () => {
    const ctx = createMockContext();
    const result = await swapValueInUSD(
      "0x0000000000000000000000000000000000000001", new BigDecimal("100"),
      "0x0000000000000000000000000000000000000002", new BigDecimal("200"),
      1, ctx,
    );
    expect(result.eq(new BigDecimal(0))).toBe(true);
  });
});
