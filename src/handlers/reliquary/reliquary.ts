import { ReliquaryContract, ReliquaryEmissionCurve } from "generated";
import BigDecimal from "bignumber.js";
import { ZERO_BD, ZERO_ADDRESS } from "../../utils/constants.js";
import { scaleDown } from "../../utils/math.js";
import { makeChainId } from "../../utils/entities.js";
import { getTokenMetadata } from "../../effects/erc20.js";
import {
  getReliquaryPositionForId,
  getReliquaryPoolInfo,
  getReliquaryLevelInfo,
  getReliquaryRewardToken,
  getReliquaryEmissionCurveAddress,
  getEmissionCurveRewardPerSecond,
  getRewarderRewardToken,
} from "../../effects/reliquary.js";

const DAY = 24 * 60 * 60;

/** Wrap handler to catch and log RPC errors instead of crashing */
function safeHandler(name: string, fn: (args: any) => Promise<void>) {
  return async (args: any) => {
    try {
      await fn(args);
    } catch (e: any) {
      args.context.log.warn("Reliquary " + name + " error: " + (e?.message || String(e)));
    }
  };
}

function reliquaryId(chainId: number, address: string): string {
  return makeChainId(chainId, address);
}

function poolId(chainId: number, pid: number): string {
  return makeChainId(chainId, `reliquary-pool-${pid}`);
}

function poolLevelId(chainId: number, pid: number, level: number): string {
  return makeChainId(chainId, `reliquary-pool-${pid}-level-${level}`);
}

function relicEntityId(chainId: number, relicId: number): string {
  return makeChainId(chainId, `relic-${relicId}`);
}

function reliquaryUserId(chainId: number, address: string): string {
  return makeChainId(chainId, `reliquary-user-${address}`);
}

function emissionCurveId(chainId: number, address: string): string {
  return makeChainId(chainId, `emission-curve-${address}`);
}

function rewarderId(chainId: number, pid: number, rewarderAddress: string): string {
  return makeChainId(chainId, `rewarder-${pid}-${rewarderAddress}`);
}

function dailyPoolSnapshotId(chainId: number, pid: number, dayTimestamp: number): string {
  return makeChainId(chainId, `reliquary-pool-snap-${pid}-${dayTimestamp}`);
}

function dailyRelicSnapshotId(relicId: number, dayTimestamp: number): string {
  return `${relicId}${dayTimestamp}`;
}

function dayTimestamp(ts: number): number {
  return ts - (ts % DAY);
}

// ================================
// Dynamic contract registration for EmissionCurve
// ================================

ReliquaryContract.LogSetEmissionCurve.contractRegister(({ event, context }) => {
  context.addReliquaryEmissionCurve(event.params.emissionCurveAddress);
});

// ================================
// LogPoolAddition
// ================================

ReliquaryContract.LogPoolAddition.handler(safeHandler("LogPoolAddition", async ({ event, context }) => {
  const { pid, allocPoint, poolToken, rewarder, nftDescriptor } = event.params;
  const chainId = event.chainId;
  const contractAddr = event.srcAddress;
  const pidNum = Number(pid);

  // Get or create reliquary
  const relId = reliquaryId(chainId, contractAddr);
  let reliquary = await context.Reliquary.get(relId);
  if (!reliquary) {
    const rewardTokenResult = await context.effect(getReliquaryRewardToken, { address: contractAddr, chainId });
    const emissionCurveResult = await context.effect(getReliquaryEmissionCurveAddress, { address: contractAddr, chainId });

    // Ensure token exists
    const tokenId = makeChainId(chainId, rewardTokenResult.rewardToken.toLowerCase());
    let token = await context.Token.get(tokenId);
    if (!token) {
      const meta = await context.effect(getTokenMetadata, { address: rewardTokenResult.rewardToken, chainId });
      context.Token.set({
        id: tokenId,
        name: meta.name,
        symbol: meta.symbol,
        decimals: meta.decimals,
        address: rewardTokenResult.rewardToken.toLowerCase(),
        latestUSDPrice: undefined,
        latestUSDPriceTimestamp: undefined,
        latestFXPrice: undefined,
        latestPrice_id: undefined,
        pool_id: undefined,
        fxOracleDecimals: undefined,
      });
    }

    // Ensure emission curve exists
    const ecId = emissionCurveId(chainId, emissionCurveResult.emissionCurve.toLowerCase());
    let ec = await context.ReliquaryEmissionCurve.get(ecId);
    if (!ec) {
      const rpsResult = await context.effect(getEmissionCurveRewardPerSecond, { address: emissionCurveResult.emissionCurve, chainId });
      context.ReliquaryEmissionCurve.set({
        id: ecId,
        address: emissionCurveResult.emissionCurve.toLowerCase(),
        rewardPerSecond: scaleDown(BigInt(rpsResult.rewardPerSecond), 18),
      });
    }

    reliquary = {
      id: relId,
      emissionToken_id: tokenId,
      totalAllocPoint: 0,
      poolCount: 0,
      relicCount: 0,
      emissionCurve_id: ecId,
    };
  }

  // Get pool info from contract
  const poolInfo = await context.effect(getReliquaryPoolInfo, { address: contractAddr, chainId, pid: pidNum.toString() });
  const levelInfo = await context.effect(getReliquaryLevelInfo, { address: contractAddr, chainId, pid: pidNum.toString() });

  // Ensure pool token exists
  const poolTokenId = makeChainId(chainId, poolToken.toLowerCase());
  let existingToken = await context.Token.get(poolTokenId);
  if (!existingToken) {
    const meta = await context.effect(getTokenMetadata, { address: poolToken, chainId });
    context.Token.set({
      id: poolTokenId,
      name: meta.name,
      symbol: meta.symbol,
      decimals: meta.decimals,
      address: poolToken.toLowerCase(),
      latestUSDPrice: undefined,
      latestUSDPriceTimestamp: undefined,
      latestFXPrice: undefined,
      latestPrice_id: undefined,
      pool_id: undefined,
      fxOracleDecimals: undefined,
    });
  }

  const pId = poolId(chainId, pidNum);
  let rewarderRef: string | undefined = undefined;
  if (rewarder.toLowerCase() !== ZERO_ADDRESS) {
    const rwId = rewarderId(chainId, pidNum, rewarder.toLowerCase());
    let existingRewarder = await context.ReliquaryRewarder.get(rwId);
    if (!existingRewarder) {
      context.ReliquaryRewarder.set({ id: rwId });
      // Get rewarder reward token
      try {
        const rwTokenResult = await context.effect(getRewarderRewardToken, { address: rewarder, chainId });
        const rwTokenId = makeChainId(chainId, rwTokenResult.rewardToken.toLowerCase());
        let rwToken = await context.Token.get(rwTokenId);
        if (!rwToken) {
          const meta = await context.effect(getTokenMetadata, { address: rwTokenResult.rewardToken, chainId });
          context.Token.set({
            id: rwTokenId,
            name: meta.name,
            symbol: meta.symbol,
            decimals: meta.decimals,
            address: rwTokenResult.rewardToken.toLowerCase(),
            latestUSDPrice: undefined,
            latestUSDPriceTimestamp: undefined,
            latestFXPrice: undefined,
            latestPrice_id: undefined,
            pool_id: undefined,
            fxOracleDecimals: undefined,
          });
        }
        const emissionId = makeChainId(chainId, `rewarder-emission-${rwId}-${rwTokenResult.rewardToken.toLowerCase()}`);
        context.ReliquaryRewarderEmission.set({
          id: emissionId,
          rewarder_id: rwId,
          rewardToken_id: rwTokenId,
          rewardTokenAddress: rwTokenResult.rewardToken.toLowerCase(),
          rewardPerSecond: ZERO_BD,
        });
      } catch {
        // Rewarder may not have rewardToken function
      }
    }
    rewarderRef = rwId;
  }

  context.ReliquaryPool.set({
    id: pId,
    pid: pidNum,
    name: poolInfo.name,
    reliquary_id: relId,
    rewarder_id: rewarderRef,
    nftDescriptor: nftDescriptor.toLowerCase(),
    poolTokenAddress: poolToken.toLowerCase(),
    poolToken_id: poolTokenId,
    totalBalance: ZERO_BD,
    relicCount: 0,
    allocPoint: Number(allocPoint),
  });

  // Create pool levels
  for (let i = 0; i < levelInfo.allocPoint.length; i++) {
    context.ReliquaryPoolLevel.set({
      id: poolLevelId(chainId, pidNum, i),
      pool_id: pId,
      level: i,
      balance: ZERO_BD,
      allocationPoints: Number(levelInfo.allocPoint[i]),
      requiredMaturity: Number(levelInfo.requiredMaturity[i]),
    });
  }

  context.Reliquary.set({
    ...reliquary,
    totalAllocPoint: reliquary.totalAllocPoint + Number(allocPoint),
    poolCount: reliquary.poolCount + 1,
  });
}));

// ================================
// LogPoolModified
// ================================

ReliquaryContract.LogPoolModified.handler(safeHandler("LogPoolModified", async ({ event, context }) => {
  const { pid, allocPoint, rewarder, nftDescriptor } = event.params;
  const chainId = event.chainId;
  const contractAddr = event.srcAddress;
  const pidNum = Number(pid);

  const pId = poolId(chainId, pidNum);
  const pool = await context.ReliquaryPool.get(pId);
  if (!pool) return;

  const relId = reliquaryId(chainId, contractAddr);
  const reliquary = await context.Reliquary.get(relId);
  if (!reliquary) return;

  let rewarderRef: string | undefined = undefined;
  if (rewarder.toLowerCase() !== ZERO_ADDRESS) {
    const rwId = rewarderId(chainId, pidNum, rewarder.toLowerCase());
    let existingRewarder = await context.ReliquaryRewarder.get(rwId);
    if (!existingRewarder) {
      context.ReliquaryRewarder.set({ id: rwId });
      try {
        const rwTokenResult = await context.effect(getRewarderRewardToken, { address: rewarder, chainId });
        const rwTokenId = makeChainId(chainId, rwTokenResult.rewardToken.toLowerCase());
        let rwToken = await context.Token.get(rwTokenId);
        if (!rwToken) {
          const meta = await context.effect(getTokenMetadata, { address: rwTokenResult.rewardToken, chainId });
          context.Token.set({
            id: rwTokenId,
            name: meta.name,
            symbol: meta.symbol,
            decimals: meta.decimals,
            address: rwTokenResult.rewardToken.toLowerCase(),
            latestUSDPrice: undefined,
            latestUSDPriceTimestamp: undefined,
            latestFXPrice: undefined,
            latestPrice_id: undefined,
            pool_id: undefined,
            fxOracleDecimals: undefined,
          });
        }
        const emissionId = makeChainId(chainId, `rewarder-emission-${rwId}-${rwTokenResult.rewardToken.toLowerCase()}`);
        context.ReliquaryRewarderEmission.set({
          id: emissionId,
          rewarder_id: rwId,
          rewardToken_id: rwTokenId,
          rewardTokenAddress: rwTokenResult.rewardToken.toLowerCase(),
          rewardPerSecond: ZERO_BD,
        });
      } catch { /* ignore */ }
    }
    rewarderRef = rwId;
  }

  const oldAllocPoint = pool.allocPoint;
  context.ReliquaryPool.set({
    ...pool,
    allocPoint: Number(allocPoint),
    rewarder_id: rewarderRef,
    nftDescriptor: nftDescriptor.toLowerCase(),
  });

  context.Reliquary.set({
    ...reliquary,
    totalAllocPoint: reliquary.totalAllocPoint - oldAllocPoint + Number(allocPoint),
  });
}));

// ================================
// LogSetEmissionCurve
// ================================

ReliquaryContract.LogSetEmissionCurve.handler(safeHandler("LogSetEmissionCurve", async ({ event, context }) => {
  const chainId = event.chainId;
  const contractAddr = event.srcAddress;
  const curveAddress = event.params.emissionCurveAddress.toLowerCase();

  const ecId = emissionCurveId(chainId, curveAddress);
  let ec = await context.ReliquaryEmissionCurve.get(ecId);
  if (!ec) {
    const rpsResult = await context.effect(getEmissionCurveRewardPerSecond, { address: event.params.emissionCurveAddress, chainId });
    context.ReliquaryEmissionCurve.set({
      id: ecId,
      address: curveAddress,
      rewardPerSecond: scaleDown(BigInt(rpsResult.rewardPerSecond), 18),
    });
  }

  const relId = reliquaryId(chainId, contractAddr);
  const reliquary = await context.Reliquary.get(relId);
  if (reliquary) {
    context.Reliquary.set({ ...reliquary, emissionCurve_id: ecId });
  }
}));

// ================================
// Deposit
// ================================

ReliquaryContract.Deposit.handler(safeHandler("Deposit", async ({ event, context }) => {
  const { pid, amount, relicId } = event.params;
  const chainId = event.chainId;
  const pidNum = Number(pid);
  const relicIdNum = Number(relicId);
  const ts = Number(event.block.timestamp);
  const scaledAmount = scaleDown(amount, 18);

  const pId = poolId(chainId, pidNum);
  const pool = await context.ReliquaryPool.get(pId);
  if (!pool) return;

  const rId = relicEntityId(chainId, relicIdNum);
  const relic = await context.Relic.get(rId);
  if (!relic) return;

  // Update pool
  context.ReliquaryPool.set({ ...pool, totalBalance: pool.totalBalance.plus(scaledAmount) });

  // Get position info for entry timestamp
  const positionInfo = await context.effect(getReliquaryPositionForId, {
    address: event.srcAddress,
    chainId,
    relicId: relicIdNum.toString(),
  });

  // Update relic
  context.Relic.set({
    ...relic,
    balance: relic.balance.plus(scaledAmount),
    entryTimestamp: Number(positionInfo.entry),
  });

  // Update pool level
  const plId = poolLevelId(chainId, pidNum, relic.level);
  const pl = await context.ReliquaryPoolLevel.get(plId);
  if (pl) {
    context.ReliquaryPoolLevel.set({ ...pl, balance: pl.balance.plus(scaledAmount) });
  }

  // Daily pool snapshot
  const dayTs = dayTimestamp(ts);
  const snapId = dailyPoolSnapshotId(chainId, pidNum, dayTs);
  const snap = await context.ReliquaryDailyPoolSnapshot.get(snapId);
  if (snap) {
    context.ReliquaryDailyPoolSnapshot.set({
      ...snap,
      totalBalance: pool.totalBalance.plus(scaledAmount),
      relicCount: pool.relicCount,
      dailyDeposited: snap.dailyDeposited.plus(scaledAmount),
    });
  } else {
    context.ReliquaryDailyPoolSnapshot.set({
      id: snapId,
      pool_id: pId,
      poolPid: pidNum,
      snapshotTimestamp: dayTs,
      totalBalance: pool.totalBalance.plus(scaledAmount),
      dailyDeposited: scaledAmount,
      dailyWithdrawn: ZERO_BD,
      relicCount: pool.relicCount,
    });
  }

  // Daily relic snapshot
  const relicSnapId = dailyRelicSnapshotId(relicIdNum, dayTs);
  const relicSnap = await context.ReliquaryDailyRelicSnapshot.get(relicSnapId);
  if (relicSnap) {
    context.ReliquaryDailyRelicSnapshot.set({
      ...relicSnap,
      balance: relic.balance.plus(scaledAmount),
      entryTimestamp: Number(positionInfo.entry),
    });
  } else {
    context.ReliquaryDailyRelicSnapshot.set({
      id: relicSnapId,
      relicId: relicIdNum,
      relic_id: rId,
      snapshotTimestamp: dayTs,
      user_id: relic.user_id,
      userAddress: relic.userAddress,
      poolPid: pidNum,
      pool_id: pId,
      balance: relic.balance.plus(scaledAmount),
      entryTimestamp: Number(positionInfo.entry),
      level: relic.level,
    });
  }
}));

// ================================
// Withdraw
// ================================

ReliquaryContract.Withdraw.handler(safeHandler("Withdraw", async ({ event, context }) => {
  const { pid, amount, relicId } = event.params;
  const chainId = event.chainId;
  const pidNum = Number(pid);
  const relicIdNum = Number(relicId);
  const ts = Number(event.block.timestamp);
  const scaledAmount = scaleDown(amount, 18);

  const pId = poolId(chainId, pidNum);
  const pool = await context.ReliquaryPool.get(pId);
  if (!pool) return;

  const rId = relicEntityId(chainId, relicIdNum);
  const relic = await context.Relic.get(rId);
  if (!relic) return;

  context.ReliquaryPool.set({ ...pool, totalBalance: pool.totalBalance.minus(scaledAmount) });
  context.Relic.set({ ...relic, balance: relic.balance.minus(scaledAmount) });

  const plId = poolLevelId(chainId, pidNum, relic.level);
  const pl = await context.ReliquaryPoolLevel.get(plId);
  if (pl) {
    context.ReliquaryPoolLevel.set({ ...pl, balance: pl.balance.minus(scaledAmount) });
  }

  // Daily pool snapshot
  const dayTs = dayTimestamp(ts);
  const snapId = dailyPoolSnapshotId(chainId, pidNum, dayTs);
  const snap = await context.ReliquaryDailyPoolSnapshot.get(snapId);
  if (snap) {
    context.ReliquaryDailyPoolSnapshot.set({
      ...snap,
      totalBalance: pool.totalBalance.minus(scaledAmount),
      relicCount: pool.relicCount,
      dailyWithdrawn: snap.dailyWithdrawn.plus(scaledAmount),
    });
  } else {
    context.ReliquaryDailyPoolSnapshot.set({
      id: snapId,
      pool_id: pId,
      poolPid: pidNum,
      snapshotTimestamp: dayTs,
      totalBalance: pool.totalBalance.minus(scaledAmount),
      dailyDeposited: ZERO_BD,
      dailyWithdrawn: scaledAmount,
      relicCount: pool.relicCount,
    });
  }

  // Daily relic snapshot
  const relicSnapId = dailyRelicSnapshotId(relicIdNum, dayTs);
  const relicSnap = await context.ReliquaryDailyRelicSnapshot.get(relicSnapId);
  if (relicSnap) {
    context.ReliquaryDailyRelicSnapshot.set({ ...relicSnap, balance: relic.balance.minus(scaledAmount) });
  } else {
    context.ReliquaryDailyRelicSnapshot.set({
      id: relicSnapId,
      relicId: relicIdNum,
      relic_id: rId,
      snapshotTimestamp: dayTs,
      user_id: relic.user_id,
      userAddress: relic.userAddress,
      poolPid: pidNum,
      pool_id: pId,
      balance: relic.balance.minus(scaledAmount),
      entryTimestamp: relic.entryTimestamp,
      level: relic.level,
    });
  }
}));

// ================================
// EmergencyWithdraw
// ================================

ReliquaryContract.EmergencyWithdraw.handler(safeHandler("EmergencyWithdraw", async ({ event, context }) => {
  const { pid, amount, relicId } = event.params;
  const chainId = event.chainId;
  const pidNum = Number(pid);
  const relicIdNum = Number(relicId);
  const ts = Number(event.block.timestamp);
  const scaledAmount = scaleDown(amount, 18);

  const pId = poolId(chainId, pidNum);
  const pool = await context.ReliquaryPool.get(pId);
  if (!pool) return;

  const rId = relicEntityId(chainId, relicIdNum);
  const relic = await context.Relic.get(rId);
  if (!relic) return;

  context.ReliquaryPool.set({ ...pool, totalBalance: pool.totalBalance.minus(scaledAmount) });
  context.Relic.set({ ...relic, balance: ZERO_BD });

  const plId = poolLevelId(chainId, pidNum, relic.level);
  const pl = await context.ReliquaryPoolLevel.get(plId);
  if (pl) {
    context.ReliquaryPoolLevel.set({ ...pl, balance: pl.balance.minus(scaledAmount) });
  }

  const dayTs = dayTimestamp(ts);
  const snapId = dailyPoolSnapshotId(chainId, pidNum, dayTs);
  const snap = await context.ReliquaryDailyPoolSnapshot.get(snapId);
  if (snap) {
    context.ReliquaryDailyPoolSnapshot.set({
      ...snap,
      totalBalance: pool.totalBalance.minus(scaledAmount),
      relicCount: pool.relicCount,
      dailyWithdrawn: snap.dailyWithdrawn.plus(scaledAmount),
    });
  } else {
    context.ReliquaryDailyPoolSnapshot.set({
      id: snapId,
      pool_id: pId,
      poolPid: pidNum,
      snapshotTimestamp: dayTs,
      totalBalance: pool.totalBalance.minus(scaledAmount),
      dailyDeposited: ZERO_BD,
      dailyWithdrawn: scaledAmount,
      relicCount: pool.relicCount,
    });
  }

  const relicSnapId = dailyRelicSnapshotId(relicIdNum, dayTs);
  const relicSnap = await context.ReliquaryDailyRelicSnapshot.get(relicSnapId);
  if (relicSnap) {
    context.ReliquaryDailyRelicSnapshot.set({ ...relicSnap, balance: ZERO_BD });
  } else {
    context.ReliquaryDailyRelicSnapshot.set({
      id: relicSnapId,
      relicId: relicIdNum,
      relic_id: rId,
      snapshotTimestamp: dayTs,
      user_id: relic.user_id,
      userAddress: relic.userAddress,
      poolPid: pidNum,
      pool_id: pId,
      balance: ZERO_BD,
      entryTimestamp: relic.entryTimestamp,
      level: relic.level,
    });
  }
}));

// ================================
// Harvest
// ================================

ReliquaryContract.Harvest.handler(safeHandler("Harvest", async ({ event, context }) => {
  const { pid, amount, to, relicId } = event.params;
  if (amount === 0n) return;

  const chainId = event.chainId;
  const relicIdNum = Number(relicId);
  const ts = Number(event.block.timestamp);

  const relId = reliquaryId(chainId, event.srcAddress);
  const reliquary = await context.Reliquary.get(relId);
  if (!reliquary) return;

  const tokenEntity = await context.Token.get(reliquary.emissionToken_id);
  const decimals = tokenEntity?.decimals ?? 18;

  // Ensure user exists
  const userId = reliquaryUserId(chainId, to.toLowerCase());
  let user = await context.ReliquaryUser.get(userId);
  if (!user) {
    context.ReliquaryUser.set({ id: userId, address: to.toLowerCase(), reliquary_id: relId });
  }

  const rId = relicEntityId(chainId, relicIdNum);
  const harvestId = makeChainId(chainId, `harvest-${relicIdNum}-${ts}`);
  context.ReliquaryHarvest.set({
    id: harvestId,
    amount: scaleDown(amount, decimals),
    token_id: reliquary.emissionToken_id,
    timestamp: ts,
    reliquary_id: relId,
    relic_id: rId,
    user_id: userId,
  });
}));

// ================================
// LevelChanged
// ================================

ReliquaryContract.LevelChanged.handler(safeHandler("LevelChanged", async ({ event, context }) => {
  const { relicId, newLevel } = event.params;
  const chainId = event.chainId;
  const relicIdNum = Number(relicId);
  const newLevelNum = Number(newLevel);
  const ts = Number(event.block.timestamp);

  const rId = relicEntityId(chainId, relicIdNum);
  const relic = await context.Relic.get(rId);
  if (!relic) return;

  // Move balance between pool levels
  const prevPlId = poolLevelId(chainId, relic.pid, relic.level);
  const prevPl = await context.ReliquaryPoolLevel.get(prevPlId);
  if (prevPl) {
    context.ReliquaryPoolLevel.set({ ...prevPl, balance: prevPl.balance.minus(relic.balance) });
  }

  const nextPlId = poolLevelId(chainId, relic.pid, newLevelNum);
  const nextPl = await context.ReliquaryPoolLevel.get(nextPlId);
  if (nextPl) {
    context.ReliquaryPoolLevel.set({ ...nextPl, balance: nextPl.balance.plus(relic.balance) });
  }

  context.Relic.set({ ...relic, level: newLevelNum, poolLevel_id: nextPlId });

  // Daily relic snapshot
  const dayTs = dayTimestamp(ts);
  const relicSnapId = dailyRelicSnapshotId(relicIdNum, dayTs);
  const relicSnap = await context.ReliquaryDailyRelicSnapshot.get(relicSnapId);
  if (relicSnap) {
    context.ReliquaryDailyRelicSnapshot.set({ ...relicSnap, level: newLevelNum });
  } else {
    context.ReliquaryDailyRelicSnapshot.set({
      id: relicSnapId,
      relicId: relicIdNum,
      relic_id: rId,
      snapshotTimestamp: dayTs,
      user_id: relic.user_id,
      userAddress: relic.userAddress,
      poolPid: relic.pid,
      pool_id: relic.pool_id,
      balance: relic.balance,
      entryTimestamp: relic.entryTimestamp,
      level: newLevelNum,
    });
  }
}));

// ================================
// Split
// ================================

ReliquaryContract.Split.handler(safeHandler("Split", async ({ event, context }) => {
  const { fromId, toId, amount } = event.params;
  const chainId = event.chainId;
  const ts = Number(event.block.timestamp);
  const scaledAmount = scaleDown(amount, 18);
  const dayTs = dayTimestamp(ts);

  const fromRId = relicEntityId(chainId, Number(fromId));
  const toRId = relicEntityId(chainId, Number(toId));

  const relicFrom = await context.Relic.get(fromRId);
  const relicTo = await context.Relic.get(toRId);
  if (!relicFrom || !relicTo) return;

  context.Relic.set({ ...relicFrom, balance: relicFrom.balance.minus(scaledAmount) });
  context.Relic.set({
    ...relicTo,
    balance: scaledAmount,
    entryTimestamp: relicFrom.entryTimestamp,
    level: relicFrom.level,
    poolLevel_id: relicFrom.poolLevel_id,
  });

  // Snapshots
  const fromSnapId = dailyRelicSnapshotId(Number(fromId), dayTs);
  const fromSnap = await context.ReliquaryDailyRelicSnapshot.get(fromSnapId);
  if (fromSnap) {
    context.ReliquaryDailyRelicSnapshot.set({ ...fromSnap, balance: relicFrom.balance.minus(scaledAmount) });
  }

  const toSnapId = dailyRelicSnapshotId(Number(toId), dayTs);
  const toSnap = await context.ReliquaryDailyRelicSnapshot.get(toSnapId);
  if (toSnap) {
    context.ReliquaryDailyRelicSnapshot.set({
      ...toSnap,
      balance: scaledAmount,
      entryTimestamp: relicFrom.entryTimestamp,
      level: relicFrom.level,
    });
  } else {
    context.ReliquaryDailyRelicSnapshot.set({
      id: toSnapId,
      relicId: Number(toId),
      relic_id: toRId,
      snapshotTimestamp: dayTs,
      user_id: relicTo.user_id,
      userAddress: relicTo.userAddress,
      poolPid: relicTo.pid,
      pool_id: relicTo.pool_id,
      balance: scaledAmount,
      entryTimestamp: relicFrom.entryTimestamp,
      level: relicFrom.level,
    });
  }
}));

// ================================
// Shift
// ================================

ReliquaryContract.Shift.handler(safeHandler("Shift", async ({ event, context }) => {
  const { fromId, toId, amount } = event.params;
  const chainId = event.chainId;
  const ts = Number(event.block.timestamp);
  const scaledAmount = scaleDown(amount, 18);
  const dayTs = dayTimestamp(ts);

  const relicFrom = await context.Relic.get(relicEntityId(chainId, Number(fromId)));
  const relicTo = await context.Relic.get(relicEntityId(chainId, Number(toId)));
  if (!relicFrom || !relicTo) return;

  // Get updated entry timestamp for relicTo
  const positionInfo = await context.effect(getReliquaryPositionForId, {
    address: event.srcAddress,
    chainId,
    relicId: toId.toString(),
  });

  context.Relic.set({ ...relicFrom, balance: relicFrom.balance.minus(scaledAmount) });

  // Update from level balance
  const fromPlId = poolLevelId(chainId, relicFrom.pid, relicFrom.level);
  const fromPl = await context.ReliquaryPoolLevel.get(fromPlId);
  if (fromPl) {
    context.ReliquaryPoolLevel.set({ ...fromPl, balance: fromPl.balance.minus(scaledAmount) });
  }

  context.Relic.set({
    ...relicTo,
    balance: relicTo.balance.plus(scaledAmount),
    entryTimestamp: Number(positionInfo.entry),
  });

  // Update to level balance
  const toPlId = poolLevelId(chainId, relicTo.pid, relicTo.level);
  const toPl = await context.ReliquaryPoolLevel.get(toPlId);
  if (toPl) {
    context.ReliquaryPoolLevel.set({ ...toPl, balance: toPl.balance.plus(scaledAmount) });
  }

  // Snapshots
  const fromSnapId = dailyRelicSnapshotId(Number(fromId), dayTs);
  const fromSnap = await context.ReliquaryDailyRelicSnapshot.get(fromSnapId);
  if (fromSnap) {
    context.ReliquaryDailyRelicSnapshot.set({ ...fromSnap, balance: relicFrom.balance.minus(scaledAmount) });
  }

  const toSnapId = dailyRelicSnapshotId(Number(toId), dayTs);
  const toSnap = await context.ReliquaryDailyRelicSnapshot.get(toSnapId);
  if (toSnap) {
    context.ReliquaryDailyRelicSnapshot.set({
      ...toSnap,
      balance: relicTo.balance.plus(scaledAmount),
      entryTimestamp: Number(positionInfo.entry),
    });
  } else {
    context.ReliquaryDailyRelicSnapshot.set({
      id: toSnapId,
      relicId: Number(toId),
      relic_id: relicEntityId(chainId, Number(toId)),
      snapshotTimestamp: dayTs,
      user_id: relicTo.user_id,
      userAddress: relicTo.userAddress,
      poolPid: relicTo.pid,
      pool_id: relicTo.pool_id,
      balance: relicTo.balance.plus(scaledAmount),
      entryTimestamp: Number(positionInfo.entry),
      level: relicTo.level,
    });
  }
}));

// ================================
// Merge
// ================================

ReliquaryContract.Merge.handler(safeHandler("Merge", async ({ event, context }) => {
  const { fromId, toId, amount } = event.params;
  const chainId = event.chainId;
  const ts = Number(event.block.timestamp);
  const scaledAmount = scaleDown(amount, 18);
  const dayTs = dayTimestamp(ts);

  const relicFrom = await context.Relic.get(relicEntityId(chainId, Number(fromId)));
  const relicTo = await context.Relic.get(relicEntityId(chainId, Number(toId)));
  if (!relicFrom || !relicTo) return;

  const positionInfo = await context.effect(getReliquaryPositionForId, {
    address: event.srcAddress,
    chainId,
    relicId: toId.toString(),
  });

  context.Relic.set({ ...relicFrom, balance: ZERO_BD });

  const fromPlId = poolLevelId(chainId, relicFrom.pid, relicFrom.level);
  const fromPl = await context.ReliquaryPoolLevel.get(fromPlId);
  if (fromPl) {
    context.ReliquaryPoolLevel.set({ ...fromPl, balance: fromPl.balance.minus(scaledAmount) });
  }

  context.Relic.set({
    ...relicTo,
    balance: relicTo.balance.plus(scaledAmount),
    entryTimestamp: Number(positionInfo.entry),
  });

  const toPlId = poolLevelId(chainId, relicTo.pid, relicTo.level);
  const toPl = await context.ReliquaryPoolLevel.get(toPlId);
  if (toPl) {
    context.ReliquaryPoolLevel.set({ ...toPl, balance: toPl.balance.plus(scaledAmount) });
  }

  // Snapshots
  const fromSnapId = dailyRelicSnapshotId(Number(fromId), dayTs);
  const fromSnap = await context.ReliquaryDailyRelicSnapshot.get(fromSnapId);
  if (fromSnap) {
    context.ReliquaryDailyRelicSnapshot.set({ ...fromSnap, balance: ZERO_BD });
  }

  const toSnapId = dailyRelicSnapshotId(Number(toId), dayTs);
  const toSnap = await context.ReliquaryDailyRelicSnapshot.get(toSnapId);
  if (toSnap) {
    context.ReliquaryDailyRelicSnapshot.set({
      ...toSnap,
      balance: relicTo.balance.plus(scaledAmount),
      entryTimestamp: Number(positionInfo.entry),
    });
  } else {
    context.ReliquaryDailyRelicSnapshot.set({
      id: toSnapId,
      relicId: Number(toId),
      relic_id: relicEntityId(chainId, Number(toId)),
      snapshotTimestamp: dayTs,
      user_id: relicTo.user_id,
      userAddress: relicTo.userAddress,
      poolPid: relicTo.pid,
      pool_id: relicTo.pool_id,
      balance: relicTo.balance.plus(scaledAmount),
      entryTimestamp: Number(positionInfo.entry),
      level: relicTo.level,
    });
  }
}));

// ================================
// Transfer (mint / burn / transfer)
// ================================

ReliquaryContract.Transfer.handler(safeHandler("Transfer", async ({ event, context }) => {
  const { from, to, tokenId } = event.params;
  const chainId = event.chainId;
  const relicIdNum = Number(tokenId);
  const ts = Number(event.block.timestamp);
  const dayTs = dayTimestamp(ts);
  const contractAddr = event.srcAddress;

  if (from.toLowerCase() === ZERO_ADDRESS) {
    // MINT — create relic
    const positionInfo = await context.effect(getReliquaryPositionForId, {
      address: contractAddr,
      chainId,
      relicId: relicIdNum.toString(),
    });

    const pidNum = Number(positionInfo.poolId);
    const pId = poolId(chainId, pidNum);
    const relId = reliquaryId(chainId, contractAddr);

    // Ensure user
    const userId = reliquaryUserId(chainId, to.toLowerCase());
    let user = await context.ReliquaryUser.get(userId);
    if (!user) {
      context.ReliquaryUser.set({ id: userId, address: to.toLowerCase(), reliquary_id: relId });
    }

    const plId = poolLevelId(chainId, pidNum, 0);
    const rId = relicEntityId(chainId, relicIdNum);
    context.Relic.set({
      id: rId,
      relicId: relicIdNum,
      reliquary_id: relId,
      pool_id: pId,
      pid: pidNum,
      userAddress: to.toLowerCase(),
      user_id: userId,
      balance: ZERO_BD,
      level: 0,
      poolLevel_id: plId,
      entryTimestamp: Number(positionInfo.entry),
    });

    // Increment counts
    const reliquary = await context.Reliquary.get(relId);
    if (reliquary) {
      context.Reliquary.set({ ...reliquary, relicCount: reliquary.relicCount + 1 });
    }

    const pool = await context.ReliquaryPool.get(pId);
    if (pool) {
      context.ReliquaryPool.set({ ...pool, relicCount: pool.relicCount + 1 });

      const snapId = dailyPoolSnapshotId(chainId, pidNum, dayTs);
      const snap = await context.ReliquaryDailyPoolSnapshot.get(snapId);
      if (snap) {
        context.ReliquaryDailyPoolSnapshot.set({ ...snap, relicCount: pool.relicCount + 1 });
      } else {
        context.ReliquaryDailyPoolSnapshot.set({
          id: snapId,
          pool_id: pId,
          poolPid: pidNum,
          snapshotTimestamp: dayTs,
          totalBalance: pool.totalBalance,
          dailyDeposited: ZERO_BD,
          dailyWithdrawn: ZERO_BD,
          relicCount: pool.relicCount + 1,
        });
      }
    }
  } else if (to.toLowerCase() === ZERO_ADDRESS) {
    // BURN
    const rId = relicEntityId(chainId, relicIdNum);
    const relic = await context.Relic.get(rId);
    if (!relic) return;

    const relId = reliquaryId(chainId, contractAddr);
    const reliquary = await context.Reliquary.get(relId);
    if (reliquary) {
      context.Reliquary.set({ ...reliquary, relicCount: reliquary.relicCount - 1 });
    }

    const zeroUserId = reliquaryUserId(chainId, ZERO_ADDRESS);
    let zeroUser = await context.ReliquaryUser.get(zeroUserId);
    if (!zeroUser) {
      context.ReliquaryUser.set({ id: zeroUserId, address: ZERO_ADDRESS, reliquary_id: relId });
    }

    context.Relic.set({ ...relic, user_id: zeroUserId, userAddress: ZERO_ADDRESS });

    const pool = await context.ReliquaryPool.get(relic.pool_id);
    if (pool) {
      context.ReliquaryPool.set({ ...pool, relicCount: pool.relicCount - 1 });

      const snapId = dailyPoolSnapshotId(chainId, relic.pid, dayTs);
      const snap = await context.ReliquaryDailyPoolSnapshot.get(snapId);
      if (snap) {
        context.ReliquaryDailyPoolSnapshot.set({ ...snap, relicCount: pool.relicCount - 1 });
      } else {
        context.ReliquaryDailyPoolSnapshot.set({
          id: snapId,
          pool_id: relic.pool_id,
          poolPid: relic.pid,
          snapshotTimestamp: dayTs,
          totalBalance: pool.totalBalance,
          dailyDeposited: ZERO_BD,
          dailyWithdrawn: ZERO_BD,
          relicCount: pool.relicCount - 1,
        });
      }
    }
  } else {
    // TRANSFER
    const rId = relicEntityId(chainId, relicIdNum);
    const relic = await context.Relic.get(rId);
    if (!relic) return;

    const relId = reliquaryId(chainId, contractAddr);
    const userId = reliquaryUserId(chainId, to.toLowerCase());
    let user = await context.ReliquaryUser.get(userId);
    if (!user) {
      context.ReliquaryUser.set({ id: userId, address: to.toLowerCase(), reliquary_id: relId });
    }

    context.Relic.set({ ...relic, user_id: userId, userAddress: to.toLowerCase() });

    const relicSnapId = dailyRelicSnapshotId(relicIdNum, dayTs);
    const relicSnap = await context.ReliquaryDailyRelicSnapshot.get(relicSnapId);
    if (relicSnap) {
      context.ReliquaryDailyRelicSnapshot.set({ ...relicSnap, user_id: userId, userAddress: to.toLowerCase() });
    }
  }
}));

// ================================
// EmissionCurve LogRate
// ================================

ReliquaryEmissionCurve.LogRate.handler(safeHandler("LogRate", async ({ event, context }) => {
  const chainId = event.chainId;
  const curveAddress = event.srcAddress.toLowerCase();
  const ecId = emissionCurveId(chainId, curveAddress);

  const ec = await context.ReliquaryEmissionCurve.get(ecId);
  if (ec) {
    context.ReliquaryEmissionCurve.set({
      ...ec,
      rewardPerSecond: scaleDown(event.params.rate, 18),
    });
  } else {
    context.ReliquaryEmissionCurve.set({
      id: ecId,
      address: curveAddress,
      rewardPerSecond: scaleDown(event.params.rate, 18),
    });
  }
}));
