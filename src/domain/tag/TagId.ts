export type TagId = number & { readonly __brand: "TagId" };

export function TagId(value: number): TagId {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`TagId inválido: ${String(value)}`);
  }
  return value as TagId;
}
