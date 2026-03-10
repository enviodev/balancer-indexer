import { describe, it, expect } from "vitest";
import { calculateAmp } from "../src/handlers/v2/poolController.js";

describe("calculateAmp", () => {
  it("returns endValue / AMP_PRECISION when blockTimestamp >= endTime", () => {
    // AMP_PRECISION = 1000
    // If block is at or past endTime, return endValue / 1000
    const result = calculateAmp(
      100000n, // startValue (amp 100 * 1000)
      200000n, // endValue (amp 200 * 1000)
      1000n,   // startTime
      2000n,   // endTime
      2000n,   // blockTimestamp = endTime
    );
    expect(result).toBe(200n); // 200000 / 1000
  });

  it("returns endValue / AMP_PRECISION when blockTimestamp > endTime", () => {
    const result = calculateAmp(
      100000n, 200000n,
      1000n, 2000n,
      3000n, // past endTime
    );
    expect(result).toBe(200n);
  });

  it("interpolates increasing amp at midpoint", () => {
    // Halfway between start and end times, should be halfway between values
    const result = calculateAmp(
      100000n, // 100 * 1000
      200000n, // 200 * 1000
      1000n,   // startTime
      2000n,   // endTime
      1500n,   // halfway
    );
    // value = 100000 + (100000 * 500 / 1000) = 100000 + 50000 = 150000
    // result = 150000 / 1000 = 150
    expect(result).toBe(150n);
  });

  it("interpolates decreasing amp at midpoint", () => {
    const result = calculateAmp(
      200000n, // start higher
      100000n, // end lower
      1000n,
      2000n,
      1500n, // halfway
    );
    // value = 200000 - (100000 * 500 / 1000) = 200000 - 50000 = 150000
    // result = 150000 / 1000 = 150
    expect(result).toBe(150n);
  });

  it("interpolates at 25% progress", () => {
    const result = calculateAmp(
      100000n, 500000n,
      0n, 1000n,
      250n, // 25%
    );
    // value = 100000 + (400000 * 250 / 1000) = 100000 + 100000 = 200000
    // result = 200000 / 1000 = 200
    expect(result).toBe(200n);
  });

  it("interpolates at 75% progress", () => {
    const result = calculateAmp(
      100000n, 500000n,
      0n, 1000n,
      750n, // 75%
    );
    // value = 100000 + (400000 * 750 / 1000) = 100000 + 300000 = 400000
    // result = 400000 / 1000 = 400
    expect(result).toBe(400n);
  });

  it("returns startValue / AMP_PRECISION at startTime", () => {
    const result = calculateAmp(
      100000n, 200000n,
      1000n, 2000n,
      1000n, // at start
    );
    // elapsed = 0, so value = 100000 + 0 = 100000
    // result = 100000 / 1000 = 100
    expect(result).toBe(100n);
  });

  it("handles same startValue and endValue", () => {
    const result = calculateAmp(
      150000n, 150000n,
      1000n, 2000n,
      1500n,
    );
    // endValue > startValue is false, so uses subtraction branch
    // value = 150000 - (0 * 500 / 1000) = 150000
    expect(result).toBe(150n);
  });

  it("handles real-world amp update values", () => {
    // Real scenario: amp going from 50 to 200 over 3 days
    const startAmp = 50000n;  // 50 * 1000
    const endAmp = 200000n;   // 200 * 1000
    const startTime = 1693000000n;
    const endTime = 1693259200n; // 3 days later
    const midTime = startTime + (endTime - startTime) / 2n;

    const result = calculateAmp(startAmp, endAmp, startTime, endTime, midTime);
    // Should be ~125 (midpoint of 50 and 200)
    expect(result).toBe(125n);
  });
});
