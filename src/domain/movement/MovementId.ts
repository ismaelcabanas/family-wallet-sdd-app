export type MovementId = number & { readonly __brand: "MovementId" };

export function MovementId(value: number): MovementId {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`MovementId inválido: ${String(value)}`);
  }
  return value as MovementId;
}
