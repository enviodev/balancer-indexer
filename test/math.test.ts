import { describe, it, expect } from "vitest";
import BigDecimal from "bignumber.js";
import { scaleDown, scaleUp, mulDown, tokenToDecimal, hexToBigInt } from "../src/utils/math.js";

describe("scaleDown", () => {
  it("scales down by 18 decimals", () => {
    const result = scaleDown(1000000000000000000n, 18);
    expect(result.eq(new BigDecimal("1"))).toBe(true);
  });

  it("scales down by 6 decimals (USDC)", () => {
    const result = scaleDown(1000000n, 6);
    expect(result.eq(new BigDecimal("1"))).toBe(true);
  });

  it("scales down by 8 decimals (WBTC)", () => {
    const result = scaleDown(100000000n, 8);
    expect(result.eq(new BigDecimal("1"))).toBe(true);
  });

  it("handles zero", () => {
    const result = scaleDown(0n, 18);
    expect(result.eq(new BigDecimal("0"))).toBe(true);
  });

  it("handles large numbers", () => {
    const result = scaleDown(1234567890123456789012345678n, 18);
    expect(result.eq(new BigDecimal("1234567890.123456789012345678"))).toBe(true);
  });

  it("handles 0 decimals", () => {
    const result = scaleDown(42n, 0);
    expect(result.eq(new BigDecimal("42"))).toBe(true);
  });
});

describe("scaleUp", () => {
  it("scales up by 18 decimals", () => {
    const result = scaleUp(new BigDecimal("1"), 18);
    expect(result).toBe(1000000000000000000n);
  });

  it("scales up by 6 decimals", () => {
    const result = scaleUp(new BigDecimal("1"), 6);
    expect(result).toBe(1000000n);
  });

  it("truncates fractional part", () => {
    const result = scaleUp(new BigDecimal("1.5"), 18);
    expect(result).toBe(1500000000000000000n);
  });

  it("handles zero", () => {
    const result = scaleUp(new BigDecimal("0"), 18);
    expect(result).toBe(0n);
  });
});

describe("mulDown", () => {
  it("multiplies and divides by 1e18", () => {
    const a = 2000000000000000000n; // 2e18
    const b = 500000000000000000n; // 0.5e18
    const result = mulDown(a, b);
    expect(result).toBe(1000000000000000000n); // 1e18
  });

  it("returns 0 when either input is 0", () => {
    expect(mulDown(0n, 1000000000000000000n)).toBe(0n);
    expect(mulDown(1000000000000000000n, 0n)).toBe(0n);
  });

  it("truncates (rounds down)", () => {
    const a = 3n;
    const b = 1n;
    const result = mulDown(a, b);
    expect(result).toBe(0n); // 3 * 1 / 1e18 = 0 (truncated)
  });
});

describe("tokenToDecimal", () => {
  it("is an alias for scaleDown", () => {
    const result = tokenToDecimal(1000000n, 6);
    expect(result.eq(new BigDecimal("1"))).toBe(true);
  });
});

describe("hexToBigInt", () => {
  it("converts hex string to bigint", () => {
    expect(hexToBigInt("0xff")).toBe(255n);
  });

  it("handles 0x prefix", () => {
    expect(hexToBigInt("0x10")).toBe(16n);
  });

  it("handles without prefix", () => {
    expect(hexToBigInt("ff")).toBe(255n);
  });

  it("handles empty string", () => {
    expect(hexToBigInt("0x")).toBe(0n);
  });

  it("handles large hex values", () => {
    expect(hexToBigInt("0xDE0B6B3A7640000")).toBe(1000000000000000000n);
  });
});
