export type AccountId = number & { readonly __brand: "AccountId" };

export function AccountId(value: number): AccountId {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`AccountId inválido: ${String(value)}`);
  }
  return value as AccountId;
}
