import { describe, it, expect } from "vitest";
import { createTestIndexer } from "generated";

// ============================================================
// Integration tests using createTestIndexer() with real HyperSync data.
// Requires ENVIO_API_TOKEN in .env for HyperSync access.
//
// These tests process real on-chain blocks through the full handler pipeline.
// Note: V2 Vault Swap handlers require pre-existing pool entities (created
// by factory events at earlier blocks), so swap events without pools are
// gracefully skipped. We verify the pipeline processes events without errors.
// ============================================================

describe("V2 Vault — real HyperSync event processing", () => {
  it("receives and processes swap events from blocks 18000100-18000200 without errors", async () => {
    const indexer = createTestIndexer();

    const result = await indexer.process({
      chains: {
        1: { startBlock: 18_000_100, endBlock: 18_000_200 },
      },
    });

    // V2 Vault Swap events exist in this range (confirmed via HyperSync query).
    // Events are received but pools don't exist yet so handler returns early.
    // The key assertion: no errors, events were received and processed.
    const totalEventsProcessed = result.changes.reduce(
      (acc, c) => acc + c.eventsProcessed,
      0,
    );
    expect(totalEventsProcessed).toBeGreaterThan(0);

    // Specific blocks we know have V2 Vault events from HyperSync query:
    // 18000105 (COMP→wstETH), 18000114, 18000189 (WETH→OHM multi-hop)
    const blockNumbers = result.changes.map((c) => c.block);
    expect(blockNumbers).toContain(18000105);
    expect(blockNumbers).toContain(18000189);
  }, 30_000);

  it("processes 500 blocks with multiple V2 Vault events", async () => {
    const indexer = createTestIndexer();

    const result = await indexer.process({
      chains: {
        1: { startBlock: 18_000_100, endBlock: 18_000_600 },
      },
    });

    // Over 500 blocks there should be many V2 Vault events
    const totalEvents = result.changes.reduce(
      (acc, c) => acc + c.eventsProcessed,
      0,
    );
    expect(totalEvents).toBeGreaterThan(5);

    // All changes should have chainId 1
    for (const change of result.changes) {
      expect(change.chainId).toBe(1);
    }
  }, 60_000);

  it("V2Balancer entity is not created by swap when pool is missing", async () => {
    const indexer = createTestIndexer();

    await indexer.process({
      chains: {
        1: { startBlock: 18_000_100, endBlock: 18_000_200 },
      },
    });

    // Swap handler returns early if pool doesn't exist, so V2Balancer shouldn't be created
    const vaultId = "1-0xBA12222222228d8Ba445958a75a0704d566BF2C8";
    const vault = await indexer.V2Balancer.get(vaultId);
    expect(vault).toBeUndefined();
  }, 30_000);
});

describe("HyperSync data integrity", () => {
  it("returns consistent block hashes across runs", async () => {
    const indexer1 = createTestIndexer();
    const indexer2 = createTestIndexer();

    const result1 = await indexer1.process({
      chains: { 1: { startBlock: 18_000_100, endBlock: 18_000_200 } },
    });
    const result2 = await indexer2.process({
      chains: { 1: { startBlock: 18_000_100, endBlock: 18_000_200 } },
    });

    // Block hashes should be identical across runs (deterministic chain data)
    const hashes1 = result1.changes.map((c) => c.blockHash);
    const hashes2 = result2.changes.map((c) => c.blockHash);
    expect(hashes1).toEqual(hashes2);

    // Same number of events
    const events1 = result1.changes.map((c) => c.eventsProcessed);
    const events2 = result2.changes.map((c) => c.eventsProcessed);
    expect(events1).toEqual(events2);
  }, 30_000);
});
