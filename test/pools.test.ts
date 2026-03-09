import { describe, it, expect } from "vitest";
import {
  getPoolTypeFromFactory,
  isLinearPoolType,
  isWeightedPoolType,
  isStablePoolType,
} from "../src/utils/v2/pools.js";

describe("getPoolTypeFromFactory", () => {
  it("returns Weighted for mainnet WeightedPoolFactory", () => {
    const result = getPoolTypeFromFactory("0x8e9aa87e45e92bad84d5f8dd1bff34fb92637de9");
    expect(result.poolType).toBe("Weighted");
  });

  it("returns Stable for mainnet StablePoolFactory", () => {
    const result = getPoolTypeFromFactory("0xc66ba2b6595d3613ccab350c886ace23866ede24");
    expect(result.poolType).toBe("Stable");
  });

  it("returns ComposableStable for relevant factory", () => {
    const result = getPoolTypeFromFactory("0xdba127fBc23fb20F5929C546af220A991b5C6e01");
    expect(result.poolType).toBe("ComposableStable");
  });

  it("returns Unknown for unknown factory", () => {
    const result = getPoolTypeFromFactory("0x0000000000000000000000000000000000000001");
    expect(result.poolType).toBe("Unknown");
  });

  it("is case insensitive", () => {
    const result = getPoolTypeFromFactory("0x8E9AA87E45E92BAD84D5F8DD1BFF34FB92637DE9");
    expect(result.poolType).toBe("Weighted");
  });

  it("returns LBP type", () => {
    const result = getPoolTypeFromFactory("0x751a0bc0e3f75b38e01cf25bfce7ff36de1c87de");
    expect(result.poolType).toBe("LiquidityBootstrapping");
  });
});

describe("isLinearPoolType", () => {
  it("returns true for AaveLinear", () => {
    expect(isLinearPoolType("AaveLinear")).toBe(true);
  });

  it("returns true for ERC4626Linear", () => {
    expect(isLinearPoolType("ERC4626Linear")).toBe(true);
  });

  it("returns true for Linear", () => {
    expect(isLinearPoolType("Linear")).toBe(true);
  });

  it("returns false for Weighted", () => {
    expect(isLinearPoolType("Weighted")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isLinearPoolType("")).toBe(false);
  });
});

describe("isWeightedPoolType", () => {
  it("returns true for Weighted", () => {
    expect(isWeightedPoolType("Weighted")).toBe(true);
  });

  it("returns true for LiquidityBootstrapping", () => {
    expect(isWeightedPoolType("LiquidityBootstrapping")).toBe(true);
  });

  it("returns true for Investment", () => {
    expect(isWeightedPoolType("Investment")).toBe(true);
  });

  it("returns false for Stable", () => {
    expect(isWeightedPoolType("Stable")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isWeightedPoolType("")).toBe(false);
  });
});

describe("isStablePoolType", () => {
  it("returns true for Stable", () => {
    expect(isStablePoolType("Stable")).toBe(true);
  });

  it("returns true for MetaStable", () => {
    expect(isStablePoolType("MetaStable")).toBe(true);
  });

  it("returns true for ComposableStable", () => {
    expect(isStablePoolType("ComposableStable")).toBe(true);
  });

  it("returns false for Weighted", () => {
    expect(isStablePoolType("Weighted")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isStablePoolType("")).toBe(false);
  });
});
