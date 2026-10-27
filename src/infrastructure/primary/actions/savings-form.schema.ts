export const INTEGER_PERCENTAGE_PATTERN = /^\d{1,3}$/;

export function parseIntegerPercentage(value: string): number {
  const trimmed = value.trim();
  const digits = trimmed.split("");
  return digits.reduce((accumulator, digit) => accumulator * 10 + Number(digit), 0);
}
