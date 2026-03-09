import { V3BPT, BigDecimal } from "generated";
import { ZERO_ADDRESS, ZERO_BD } from "../../utils/constants.js";
import { tokenToDecimal } from "../../utils/math.js";
import { makeChainId, getPoolShareId, defaultV3PoolShare, defaultUser } from "../../utils/entities.js";

const BPT_DECIMALS = 18;

V3BPT.Transfer.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const poolAddress = event.srcAddress;
  const poolId = makeChainId(chainId, poolAddress);

  const isMint = event.params.from === ZERO_ADDRESS;
  const isBurn = event.params.to === ZERO_ADDRESS;

  const pool = await context.V3Pool.get(poolId);
  if (!pool) return;

  const amount = tokenToDecimal(event.params.value, BPT_DECIMALS);

  // Get or create shares for from/to
  const fromShareId = getPoolShareId(chainId, poolAddress, event.params.from);
  const toShareId = getPoolShareId(chainId, poolAddress, event.params.to);

  let poolShareFrom = await context.V3PoolShare.get(fromShareId);
  let poolShareTo = await context.V3PoolShare.get(toShareId);

  const prevFromBalance = poolShareFrom?.balance ?? ZERO_BD;
  const prevToBalance = poolShareTo?.balance ?? ZERO_BD;

  if (!poolShareFrom) {
    const userId = makeChainId(chainId, event.params.from);
    const user = await context.User.get(userId);
    if (!user) context.User.set(defaultUser(chainId, event.params.from));
    poolShareFrom = defaultV3PoolShare(chainId, poolAddress, event.params.from);
  }

  if (!poolShareTo) {
    const userId = makeChainId(chainId, event.params.to);
    const user = await context.User.get(userId);
    if (!user) context.User.set(defaultUser(chainId, event.params.to));
    poolShareTo = defaultV3PoolShare(chainId, poolAddress, event.params.to);
  }

  let updatedPool = { ...pool };

  if (isMint) {
    context.V3PoolShare.set({ ...poolShareTo, balance: poolShareTo.balance.plus(amount) });
    updatedPool.totalShares = pool.totalShares.plus(amount);
  } else if (isBurn) {
    context.V3PoolShare.set({ ...poolShareFrom, balance: poolShareFrom.balance.minus(amount) });
    updatedPool.totalShares = pool.totalShares.minus(amount);
  } else {
    context.V3PoolShare.set({ ...poolShareTo, balance: poolShareTo.balance.plus(amount) });
    context.V3PoolShare.set({ ...poolShareFrom, balance: poolShareFrom.balance.minus(amount) });
  }

  // Track holders count
  const newToBalance = isBurn ? prevToBalance : poolShareTo.balance.plus(amount);
  const newFromBalance = isMint ? prevFromBalance : poolShareFrom.balance.minus(amount);

  if (!newToBalance.eq(ZERO_BD) && prevToBalance.eq(ZERO_BD)) {
    updatedPool.holdersCount = updatedPool.holdersCount + 1n;
  }

  if (newFromBalance.eq(ZERO_BD) && !prevFromBalance.eq(ZERO_BD)) {
    updatedPool.holdersCount = updatedPool.holdersCount - 1n;
  }

  context.V3Pool.set(updatedPool);
});
