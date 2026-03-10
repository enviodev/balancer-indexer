import { describe, it, expect } from "vitest";
import BigDecimal from "bignumber.js";
import {
  V2Vault_Swap_createMockEvent,
  V2Vault_Swap_processEvent,
  V2Vault_PoolBalanceChanged_createMockEvent,
  V2Vault_PoolBalanceChanged_processEvent,
} from "generated/src/TestHelpers.gen.js";
import { createMockDb } from "generated/src/TestHelpers_MockDb.gen.js";
import { ZERO_BD, ZERO_BI, V2_VAULT_ADDRESS } from "../src/utils/constants.js";
import { defaultV2Pool, defaultV2Balancer } from "../src/utils/v2/entities.js";
import { defaultToken, defaultUser, makeChainId } from "../src/utils/entities.js";

// ============================================================
// Integration tests using MockDb with real event data obtained
// from Ethereum mainnet via HyperSync queries.
//
// Real swap data from blocks 18000105 and 18000189 (Aug 26, 2023).
// ============================================================

// --- Real on-chain data from HyperSync ---

// Block 18000189: WETH → OHM swap on pool 0x08775ccb...
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const OHM = "0x79c58f70905f734641735bc61e45c19dd9ad60bc";
const USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7";
const COMP = "0xc00e94cb662c3520282e6f5717214004a7f26888";
const WSTETH = "0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0";

const POOL1_ADDRESS = "0x08775ccb6674d6bdceb0797c364c2653ed84f384";
const POOL1_ID = "0x08775ccb6674d6bdceb0797c364c2653ed84f3840002000000000000000004f0";

const POOL2_ADDRESS = "0x87a867f5d240a782d43d90b6b06dea470f3f8f22";
const POOL2_ID = "0x87a867f5d240a782d43d90b6b06dea470f3f8f22000200000000000000000516";

const CHAIN_ID = 1;

function seedMockDb() {
  let db = createMockDb();

  // Seed V2Balancer (global vault entity)
  db = db.entities.V2Balancer.set({
    ...defaultV2Balancer(CHAIN_ID, V2_VAULT_ADDRESS),
  });

  // Seed Pool 1: WETH/OHM weighted pool
  const pool1 = {
    ...defaultV2Pool(CHAIN_ID, POOL1_ADDRESS),
    poolType: "Weighted",
    swapFee: new BigDecimal("0.003"), // 0.3%
    tokensList: [WETH, OHM],
    vaultID_id: makeChainId(CHAIN_ID, V2_VAULT_ADDRESS),
  };
  db = db.entities.V2Pool.set(pool1);

  // Seed Pool 1 tokens
  db = db.entities.V2PoolToken.set({
    id: `${CHAIN_ID}-${POOL1_ADDRESS}-${WETH}`,
    pool_id: makeChainId(CHAIN_ID, POOL1_ADDRESS),
    token_id: makeChainId(CHAIN_ID, WETH),
    address: WETH,
    symbol: "WETH",
    name: "Wrapped Ether",
    decimals: 18,
    index: 0,
    balance: new BigDecimal("100"),
    priceRate: new BigDecimal("1"),
    weight: new BigDecimal("0.5"),
    isExemptFromYieldProtocolFee: undefined,
    cashBalance: ZERO_BD,
    managedBalance: ZERO_BD,
    oldPriceRate: undefined,
    assetManager: "",
    paidProtocolFees: undefined,
    circuitBreaker_id: undefined,
  });

  db = db.entities.V2PoolToken.set({
    id: `${CHAIN_ID}-${POOL1_ADDRESS}-${OHM}`,
    pool_id: makeChainId(CHAIN_ID, POOL1_ADDRESS),
    token_id: makeChainId(CHAIN_ID, OHM),
    address: OHM,
    symbol: "OHM",
    name: "Olympus",
    decimals: 18,
    index: 1,
    balance: new BigDecimal("10000"),
    priceRate: new BigDecimal("1"),
    weight: new BigDecimal("0.5"),
    isExemptFromYieldProtocolFee: undefined,
    cashBalance: ZERO_BD,
    managedBalance: ZERO_BD,
    oldPriceRate: undefined,
    assetManager: "",
    paidProtocolFees: undefined,
    circuitBreaker_id: undefined,
  });

  // Seed Token entities
  db = db.entities.Token.set({
    ...defaultToken(CHAIN_ID, WETH),
    name: "Wrapped Ether",
    symbol: "WETH",
    decimals: 18,
    latestUSDPrice: new BigDecimal("1650"),
    latestUSDPriceTimestamp: 1693060000n,
  });

  db = db.entities.Token.set({
    ...defaultToken(CHAIN_ID, OHM),
    name: "Olympus",
    symbol: "OHM",
    decimals: 18,
  });

  // Seed Pool 2: COMP/wstETH weighted pool
  const pool2 = {
    ...defaultV2Pool(CHAIN_ID, POOL2_ADDRESS),
    poolType: "Weighted",
    swapFee: new BigDecimal("0.003"),
    tokensList: [COMP, WSTETH],
    vaultID_id: makeChainId(CHAIN_ID, V2_VAULT_ADDRESS),
  };
  db = db.entities.V2Pool.set(pool2);

  db = db.entities.V2PoolToken.set({
    id: `${CHAIN_ID}-${POOL2_ADDRESS}-${COMP}`,
    pool_id: makeChainId(CHAIN_ID, POOL2_ADDRESS),
    token_id: makeChainId(CHAIN_ID, COMP),
    address: COMP,
    symbol: "COMP",
    name: "Compound",
    decimals: 18,
    index: 0,
    balance: new BigDecimal("5000"),
    priceRate: new BigDecimal("1"),
    weight: new BigDecimal("0.5"),
    isExemptFromYieldProtocolFee: undefined,
    cashBalance: ZERO_BD,
    managedBalance: ZERO_BD,
    oldPriceRate: undefined,
    assetManager: "",
    paidProtocolFees: undefined,
    circuitBreaker_id: undefined,
  });

  db = db.entities.V2PoolToken.set({
    id: `${CHAIN_ID}-${POOL2_ADDRESS}-${WSTETH}`,
    pool_id: makeChainId(CHAIN_ID, POOL2_ADDRESS),
    token_id: makeChainId(CHAIN_ID, WSTETH),
    address: WSTETH,
    symbol: "wstETH",
    name: "Wrapped stETH",
    decimals: 18,
    index: 1,
    balance: new BigDecimal("200"),
    priceRate: new BigDecimal("1"),
    weight: new BigDecimal("0.5"),
    isExemptFromYieldProtocolFee: undefined,
    cashBalance: ZERO_BD,
    managedBalance: ZERO_BD,
    oldPriceRate: undefined,
    assetManager: "",
    paidProtocolFees: undefined,
    circuitBreaker_id: undefined,
  });

  db = db.entities.Token.set({
    ...defaultToken(CHAIN_ID, COMP),
    name: "Compound",
    symbol: "COMP",
    decimals: 18,
  });

  db = db.entities.Token.set({
    ...defaultToken(CHAIN_ID, WSTETH),
    name: "Wrapped stETH",
    symbol: "wstETH",
    decimals: 18,
  });

  return db;
}

describe("V2 Vault Swap — real event data via MockDb", () => {
  it("processes WETH→OHM swap from block 18000189", async () => {
    const mockDb = seedMockDb();

    // Real event data: 1.7746 WETH → 2922.21 OHM
    const event = V2Vault_Swap_createMockEvent({
      poolId: POOL1_ID,
      tokenIn: WETH,
      tokenOut: OHM,
      amountIn: 1774623378413453785n,
      amountOut: 2922212372696511241298n,
      mockEventData: {
        chainId: CHAIN_ID,
        srcAddress: V2_VAULT_ADDRESS,
        logIndex: 93,
        block: {
          number: 18000189,
          timestamp: 1693069163,
          hash: "0x051e6f9e0720e7c34e6f6b1ea541a7530fc2dd7a0127016da953fb758e24c6d2",
        },
        transaction: {
          from: "0x1d80acdcae2257329557ae12c1d1fc21361def30",
          hash: "0xf5159a3bc2be996ab98e5233d1d3bba9ac3d9230b9cace9c737ace3424618108",
        },
      },
    });

    const resultDb = await V2Vault_Swap_processEvent({
      event,
      mockDb,
      chainId: CHAIN_ID,
    });

    // Verify V2Swap entity was created
    const swapId = `${CHAIN_ID}_18000189_93`;
    const swap = resultDb.entities.V2Swap.get(swapId);
    expect(swap).toBeDefined();
    expect(swap!.tokenIn).toBe(WETH);
    expect(swap!.tokenOut).toBe(OHM);
    expect(swap!.tokenInSym).toBe("WETH");
    expect(swap!.tokenOutSym).toBe("OHM");
    expect(swap!.pool_id).toBe(`${CHAIN_ID}-${POOL1_ADDRESS}`);
    expect(swap!.tx).toBe("0xf5159a3bc2be996ab98e5233d1d3bba9ac3d9230b9cace9c737ace3424618108");

    // Verify tokenAmountIn is correctly scaled (1.7746... ETH)
    expect(swap!.tokenAmountIn.gt(new BigDecimal("1.77"))).toBe(true);
    expect(swap!.tokenAmountIn.lt(new BigDecimal("1.78"))).toBe(true);

    // Verify tokenAmountOut is correctly scaled (2922.21... OHM)
    expect(swap!.tokenAmountOut.gt(new BigDecimal("2922"))).toBe(true);
    expect(swap!.tokenAmountOut.lt(new BigDecimal("2923"))).toBe(true);

    // Verify pool token balances were updated
    const poolTokenIn = resultDb.entities.V2PoolToken.get(`${CHAIN_ID}-${POOL1_ADDRESS}-${WETH}`);
    expect(poolTokenIn).toBeDefined();
    // Balance should increase by amountIn (100 + 1.7746)
    expect(poolTokenIn!.balance.gt(new BigDecimal("101.77"))).toBe(true);

    const poolTokenOut = resultDb.entities.V2PoolToken.get(`${CHAIN_ID}-${POOL1_ADDRESS}-${OHM}`);
    expect(poolTokenOut).toBeDefined();
    // Balance should decrease by amountOut (10000 - 2922.21)
    expect(poolTokenOut!.balance.lt(new BigDecimal("7078"))).toBe(true);
    expect(poolTokenOut!.balance.gt(new BigDecimal("7077"))).toBe(true);

    // Verify pool swap count incremented
    const pool = resultDb.entities.V2Pool.get(`${CHAIN_ID}-${POOL1_ADDRESS}`);
    expect(pool).toBeDefined();
    expect(pool!.swapsCount).toBe(1n);

    // Verify V2Balancer global stats updated
    const vault = resultDb.entities.V2Balancer.get(makeChainId(CHAIN_ID, V2_VAULT_ADDRESS));
    expect(vault).toBeDefined();
    expect(vault!.totalSwapCount).toBe(1n);

    // Verify User entity was created for the swapper
    const user = resultDb.entities.User.get(`${CHAIN_ID}-0x1d80acdcae2257329557ae12c1d1fc21361def30`);
    expect(user).toBeDefined();
  });

  it("processes COMP→wstETH swap from block 18000105", async () => {
    const mockDb = seedMockDb();

    // Real event: 476.794 COMP → 10.728 wstETH
    const event = V2Vault_Swap_createMockEvent({
      poolId: POOL2_ID,
      tokenIn: COMP,
      tokenOut: WSTETH,
      amountIn: 476794000000000000000n,
      amountOut: 10728140945863548400n,
      mockEventData: {
        chainId: CHAIN_ID,
        srcAddress: V2_VAULT_ADDRESS,
        logIndex: 245,
        block: {
          number: 18000105,
          timestamp: 1693068155,
          hash: "0x41f9e2b6a7767927f7cb77c50438a90439278ba824076e5d54d0eed4c68c9b32",
        },
        transaction: {
          from: "0x50186ba2efb51dd1a241467492c333514516be22",
          hash: "0x294f20cf13b48da46aa7ea1b305f9e6d79cbacbf31d5a7ea61c8833756c58793",
        },
      },
    });

    const resultDb = await V2Vault_Swap_processEvent({
      event,
      mockDb,
      chainId: CHAIN_ID,
    });

    const swapId = `${CHAIN_ID}_18000105_245`;
    const swap = resultDb.entities.V2Swap.get(swapId);
    expect(swap).toBeDefined();
    expect(swap!.tokenIn).toBe(COMP);
    expect(swap!.tokenOut).toBe(WSTETH);

    // 476.794 COMP
    expect(swap!.tokenAmountIn.gt(new BigDecimal("476.79"))).toBe(true);
    expect(swap!.tokenAmountIn.lt(new BigDecimal("476.80"))).toBe(true);

    // 10.728 wstETH
    expect(swap!.tokenAmountOut.gt(new BigDecimal("10.72"))).toBe(true);
    expect(swap!.tokenAmountOut.lt(new BigDecimal("10.73"))).toBe(true);
  });

  it("processes sequential swaps and accumulates pool stats", async () => {
    let mockDb = seedMockDb();

    // First swap: WETH → OHM
    const event1 = V2Vault_Swap_createMockEvent({
      poolId: POOL1_ID,
      tokenIn: WETH,
      tokenOut: OHM,
      amountIn: 1774623378413453785n,
      amountOut: 2922212372696511241298n,
      mockEventData: {
        chainId: CHAIN_ID,
        srcAddress: V2_VAULT_ADDRESS,
        logIndex: 93,
        block: { number: 18000189, timestamp: 1693069163 },
        transaction: {
          from: "0x1d80acdcae2257329557ae12c1d1fc21361def30",
          hash: "0xf5159a3bc2be996ab98e5233d1d3bba9ac3d9230b9cace9c737ace3424618108",
        },
      },
    });

    mockDb = await V2Vault_Swap_processEvent({
      event: event1,
      mockDb,
      chainId: CHAIN_ID,
    });

    // Second swap on same pool: another WETH → OHM with different amounts
    const event2 = V2Vault_Swap_createMockEvent({
      poolId: POOL1_ID,
      tokenIn: WETH,
      tokenOut: OHM,
      amountIn: 500000000000000000n, // 0.5 WETH
      amountOut: 800000000000000000000n, // 800 OHM
      mockEventData: {
        chainId: CHAIN_ID,
        srcAddress: V2_VAULT_ADDRESS,
        logIndex: 100,
        block: { number: 18000190, timestamp: 1693069175 },
        transaction: {
          from: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          hash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        },
      },
    });

    mockDb = await V2Vault_Swap_processEvent({
      event: event2,
      mockDb,
      chainId: CHAIN_ID,
    });

    // Pool should have 2 swaps
    const pool = mockDb.entities.V2Pool.get(`${CHAIN_ID}-${POOL1_ADDRESS}`);
    expect(pool!.swapsCount).toBe(2n);

    // V2Balancer global count should be 2
    const vault = mockDb.entities.V2Balancer.get(makeChainId(CHAIN_ID, V2_VAULT_ADDRESS));
    expect(vault!.totalSwapCount).toBe(2n);

    // WETH balance should reflect both deposits (100 + 1.7746 + 0.5)
    const wethToken = mockDb.entities.V2PoolToken.get(`${CHAIN_ID}-${POOL1_ADDRESS}-${WETH}`);
    expect(wethToken!.balance.gt(new BigDecimal("102.27"))).toBe(true);

    // OHM balance should reflect both withdrawals (10000 - 2922.21 - 800)
    const ohmToken = mockDb.entities.V2PoolToken.get(`${CHAIN_ID}-${POOL1_ADDRESS}-${OHM}`);
    expect(ohmToken!.balance.lt(new BigDecimal("6278"))).toBe(true);
    expect(ohmToken!.balance.gt(new BigDecimal("6277"))).toBe(true);

    // Both users should exist
    expect(mockDb.entities.User.get(`${CHAIN_ID}-0x1d80acdcae2257329557ae12c1d1fc21361def30`)).toBeDefined();
    expect(mockDb.entities.User.get(`${CHAIN_ID}-0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`)).toBeDefined();
  });

  it("creates TokenPrice entities when pricing assets are involved", async () => {
    const mockDb = seedMockDb();

    // WETH is a pricing asset on Ethereum mainnet, so this swap should create a V2TokenPrice
    const event = V2Vault_Swap_createMockEvent({
      poolId: POOL1_ID,
      tokenIn: WETH,
      tokenOut: OHM,
      amountIn: 1774623378413453785n,
      amountOut: 2922212372696511241298n,
      mockEventData: {
        chainId: CHAIN_ID,
        srcAddress: V2_VAULT_ADDRESS,
        logIndex: 93,
        block: { number: 18000189, timestamp: 1693069163 },
        transaction: {
          from: "0x1d80acdcae2257329557ae12c1d1fc21361def30",
          hash: "0xaaa",
        },
      },
    });

    const resultDb = await V2Vault_Swap_processEvent({
      event,
      mockDb,
      chainId: CHAIN_ID,
    });

    // WETH is a pricing asset, so OHM should get a TokenPrice (priced in WETH)
    // TokenPrice ID format: chainId-poolAddress-asset-pricingAsset-blockNumber
    const tokenPriceId = `${CHAIN_ID}-${POOL1_ADDRESS}-${OHM}-${WETH}-18000189`;
    const tokenPrice = resultDb.entities.V2TokenPrice.get(tokenPriceId);
    expect(tokenPrice).toBeDefined();
    expect(tokenPrice!.asset).toBe(OHM);
    expect(tokenPrice!.pricingAsset).toBe(WETH);
    expect(tokenPrice!.pool_id).toBe(`${CHAIN_ID}-${POOL1_ADDRESS}`);

    // Price = amountIn / amountOut = 1.7746/2922.21 ≈ 0.000607 WETH per OHM
    expect(tokenPrice!.price.gt(new BigDecimal("0.0006"))).toBe(true);
    expect(tokenPrice!.price.lt(new BigDecimal("0.00065"))).toBe(true);
  });

  it("handles swap on pool that doesn't exist (no-op)", async () => {
    const mockDb = seedMockDb();

    // Use a poolId that doesn't exist in the mock db
    const event = V2Vault_Swap_createMockEvent({
      poolId: "0x0000000000000000000000000000000000000001000200000000000000000000",
      tokenIn: WETH,
      tokenOut: OHM,
      amountIn: 1000000000000000000n,
      amountOut: 1000000000000000000000n,
      mockEventData: {
        chainId: CHAIN_ID,
        srcAddress: V2_VAULT_ADDRESS,
        logIndex: 1,
        block: { number: 18000200, timestamp: 1693069300 },
        transaction: {
          from: "0x1111111111111111111111111111111111111111",
          hash: "0xccc",
        },
      },
    });

    const resultDb = await V2Vault_Swap_processEvent({
      event,
      mockDb,
      chainId: CHAIN_ID,
    });

    // No swap entity should be created since pool doesn't exist
    const allSwaps = resultDb.entities.V2Swap.getAll();
    expect(allSwaps).toHaveLength(0);

    // V2Balancer should not be modified
    const vault = resultDb.entities.V2Balancer.get(makeChainId(CHAIN_ID, V2_VAULT_ADDRESS));
    expect(vault!.totalSwapCount).toBe(ZERO_BI);
  });
});
