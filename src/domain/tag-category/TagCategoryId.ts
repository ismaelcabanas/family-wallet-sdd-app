export type TagCategoryId = number & { readonly __brand: "TagCategoryId" };

export function TagCategoryId(value: number): TagCategoryId {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`TagCategoryId inválido: ${String(value)}`);
  }
  return value as TagCategoryId;
}
