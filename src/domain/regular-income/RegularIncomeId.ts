export type RegularIncomeId = number & { readonly __brand: "RegularIncomeId" };

export function RegularIncomeId(value: number): RegularIncomeId {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`RegularIncomeId inválido: ${String(value)}`);
  }
  return value as RegularIncomeId;
}
