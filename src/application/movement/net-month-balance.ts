export interface NetMonthBalanceSavings {
  amountCents: number;
  backedByMovement: boolean;
}

export function netMonthBalanceCents(
  monthBalanceCents: number,
  savings: NetMonthBalanceSavings,
): number {
  return monthBalanceCents - (savings.backedByMovement ? 0 : savings.amountCents);
}
