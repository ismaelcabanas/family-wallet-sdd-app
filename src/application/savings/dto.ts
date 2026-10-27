import type { SavingsAllocation } from "@/domain/savings/SavingsAllocation";

export interface SavingsAllocationDTO {
  accountId: number;
  percentage: number;
  active: boolean;
  activatedAtMonth: string;
}

export function toSavingsAllocationDTO(config: SavingsAllocation): SavingsAllocationDTO {
  return {
    accountId: config.accountId as number,
    percentage: config.percentage.percent,
    active: config.active,
    activatedAtMonth: config.activatedAtMonth,
  };
}
