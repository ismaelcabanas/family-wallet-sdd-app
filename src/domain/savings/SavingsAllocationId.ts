export type SavingsAllocationId = number & { readonly __brand: "SavingsAllocationId" };

export function SavingsAllocationId(value: number): SavingsAllocationId {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`SavingsAllocationId inválido: ${String(value)}`);
  }
  return value as SavingsAllocationId;
}
