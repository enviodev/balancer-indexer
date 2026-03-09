import { describe, it, expect } from "vitest";
import BigDecimal from "bignumber.js";
import { makeChainId, getPoolShareId, getPoolTokenId, createSnapshotId } from "../src/utils/entities.js";
import {
  v2PoolShareId,
  v2PoolTokenId,
  v2SnapshotId,
  defaultV2Balancer,
  defaultV2Pool,
  defaultV2PoolToken,
  defaultV2PoolShare,
  defaultV2PoolContract,
  defaultV2PoolSnapshot,
  defaultV2BalancerSnapshot,
} from "../src/utils/v2/entities.js";
import { ZERO_BD, ZERO_BI, ZERO_ADDRESS } from "../src/utils/constants.js";

// ================================
// ID Generation
// ================================

describe("makeChainId", () => {
  it("creates chainId-address format", () => {
    expect(makeChainId(1, "0xabc")).toBe("1-0xabc");
  });

  it("handles different chain IDs", () => {
    expect(makeChainId(137, "0xabc")).toBe("137-0xabc");
    expect(makeChainId(42161, "0xdef")).toBe("42161-0xdef");
  });
});

describe("v2PoolShareId", () => {
  it("creates chainId-pool-user format", () => {
    expect(v2PoolShareId(1, "0xpool", "0xuser")).toBe("1-0xpool-0xuser");
  });
});

describe("v2PoolTokenId", () => {
  it("creates chainId-pool-token format", () => {
    expect(v2PoolTokenId(1, "0xpool", "0xtoken")).toBe("1-0xpool-0xtoken");
  });
});

describe("v2SnapshotId", () => {
  it("normalizes timestamp to day boundary", () => {
    const DAY = 86400;
    const timestamp = DAY * 10 + 3600; // 10 days + 1 hour
    const expected = `1-0xpool-${DAY * 10}`;
    expect(v2SnapshotId(1, "0xpool", timestamp)).toBe(expected);
  });

  it("exact day boundary stays the same", () => {
    const DAY = 86400;
    const timestamp = DAY * 10;
    const expected = `1-0xpool-${timestamp}`;
    expect(v2SnapshotId(1, "0xpool", timestamp)).toBe(expected);
  });
});

// ================================
// Default Entity Factories
// ================================

describe("defaultV2Balancer", () => {
  it("creates a valid V2Balancer entity", () => {
    const entity = defaultV2Balancer(1, "0xvault");
    expect(entity.id).toBe("1-0xvault");
    expect(entity.poolCount).toBe(0);
    expect(entity.totalLiquidity.eq(ZERO_BD)).toBe(true);
    expect(entity.totalSwapCount).toBe(ZERO_BI);
    expect(entity.totalSwapVolume.eq(ZERO_BD)).toBe(true);
    expect(entity.totalSwapFee.eq(ZERO_BD)).toBe(true);
    expect(entity.totalProtocolFee!.eq(ZERO_BD)).toBe(true);
    expect(entity.protocolFeesCollector).toBe(ZERO_ADDRESS);
  });
});

describe("defaultV2Pool", () => {
  it("creates a valid V2Pool entity with all fields initialized", () => {
    const entity = defaultV2Pool(1, "0xpool");
    expect(entity.id).toBe("1-0xpool");
    expect(entity.address).toBe("0xpool");
    expect(entity.swapEnabled).toBe(true);
    expect(entity.swapFee.eq(ZERO_BD)).toBe(true);
    expect(entity.totalSwapVolume.eq(ZERO_BD)).toBe(true);
    expect(entity.totalShares.eq(ZERO_BD)).toBe(true);
    expect(entity.swapsCount).toBe(ZERO_BI);
    expect(entity.holdersCount).toBe(ZERO_BI);
    expect(entity.tokensList).toEqual([]);
    expect(entity.poolType).toBeUndefined();
    expect(entity.amp).toBeUndefined();
  });
});

describe("defaultV2PoolToken", () => {
  it("creates a valid V2PoolToken entity", () => {
    const entity = defaultV2PoolToken(1, "0xpool", "0xtoken", 0);
    expect(entity.id).toBe("1-0xpool-0xtoken");
    expect(entity.pool_id).toBe("1-0xpool");
    expect(entity.token_id).toBe("1-0xtoken");
    expect(entity.index).toBe(0);
    expect(entity.balance.eq(ZERO_BD)).toBe(true);
    expect(entity.priceRate.eq(new BigDecimal(1))).toBe(true);
    expect(entity.weight).toBeUndefined();
  });
});

describe("defaultV2PoolShare", () => {
  it("creates a valid V2PoolShare entity", () => {
    const entity = defaultV2PoolShare(1, "0xpool", "0xuser");
    expect(entity.id).toBe("1-0xpool-0xuser");
    expect(entity.pool_id).toBe("1-0xpool");
    expect(entity.user_id).toBe("1-0xuser");
    expect(entity.balance.eq(ZERO_BD)).toBe(true);
  });
});

describe("defaultV2PoolContract", () => {
  it("creates a valid V2PoolContract entity", () => {
    const entity = defaultV2PoolContract(1, "0xpool");
    expect(entity.id).toBe("1-0xpool");
    expect(entity.pool_id).toBe("1-0xpool");
  });
});

describe("defaultV2PoolSnapshot", () => {
  it("normalizes timestamp to day boundary", () => {
    const DAY = 86400;
    const timestamp = DAY * 10 + 7200;
    const entity = defaultV2PoolSnapshot(1, "0xpool", timestamp);
    expect(entity.timestamp).toBe(DAY * 10);
    expect(entity.amounts).toEqual([]);
    expect(entity.totalShares.eq(ZERO_BD)).toBe(true);
  });
});

describe("defaultV2BalancerSnapshot", () => {
  it("normalizes timestamp to day boundary", () => {
    const DAY = 86400;
    const timestamp = DAY * 10 + 100;
    const entity = defaultV2BalancerSnapshot(1, "0xvault", timestamp);
    expect(entity.timestamp).toBe(DAY * 10);
    expect(entity.poolCount).toBe(0);
    expect(entity.totalLiquidity.eq(ZERO_BD)).toBe(true);
  });
});
