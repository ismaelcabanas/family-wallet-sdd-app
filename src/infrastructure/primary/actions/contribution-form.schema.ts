export const PERCENTAGE_PATTERN = /^\d{1,3}([.,]\d{1,2})?$/;

export function parsePercentageToBasisPoints(value: string): number {
  const normalized = value.trim().replace(".", ",");
  const [integerPart, decimalPart = ""] = normalized.split(",");
  const paddedDecimals = decimalPart.padEnd(2, "0");
  return Number(integerPart) * 100 + Number(paddedDecimals);
}
