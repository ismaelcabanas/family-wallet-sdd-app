export type MemberId = number & { readonly __brand: "MemberId" };

export function MemberId(value: number): MemberId {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`MemberId inválido: ${String(value)}`);
  }
  return value as MemberId;
}
