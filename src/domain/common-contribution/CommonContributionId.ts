export type CommonContributionId = number & { readonly __brand: "CommonContributionId" };

export function CommonContributionId(value: number): CommonContributionId {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`CommonContributionId inválido: ${String(value)}`);
  }
  return value as CommonContributionId;
}
