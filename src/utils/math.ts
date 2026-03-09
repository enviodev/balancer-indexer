import BigDecimal from "bignumber.js";

const ONE_E18 = 10n ** 18n;

export function scaleDown(num: bigint, decimals: number): BigDecimal {
  const divisor = 10n ** BigInt(decimals);
  return new BigDecimal(num.toString()).div(new BigDecimal(divisor.toString()));
}

export function scaleUp(num: BigDecimal, decimals: number): bigint {
  const multiplier = 10n ** BigInt(decimals);
  const result = num.times(new BigDecimal(multiplier.toString())).integerValue(BigDecimal.ROUND_DOWN);
  return BigInt(result.toFixed(0));
}

export function mulDown(a: bigint, b: bigint): bigint {
  return (a * b) / ONE_E18;
}

export function mulDownSwapFee(swapFeeAmountRaw: bigint, swapFeePercentage: BigDecimal): bigint {
  return mulDown(swapFeeAmountRaw, scaleUp(swapFeePercentage, 18));
}

export function tokenToDecimal(amount: bigint, decimals: number): BigDecimal {
  return scaleDown(amount, decimals);
}

export function hexToBigInt(hex: string): bigint {
  if (hex.startsWith("0x") || hex.startsWith("0X")) {
    hex = hex.slice(2);
  }
  if (hex.length === 0) return 0n;
  return BigInt("0x" + hex);
}
