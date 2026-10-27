import { AccountId } from "@/domain/account/AccountId";
import { SavingsAllocation } from "@/domain/savings/SavingsAllocation";
import { SavingsPercentage } from "@/domain/savings/SavingsPercentage";

import type { NewSavingsAllocationRow, SavingsAllocationRow } from "../schema/savings-allocations";

export function mapSavingsAllocationToRow(config: SavingsAllocation): NewSavingsAllocationRow {
  return {
    ...(config.id === null ? {} : { id: config.id as number }),
    accountId: config.accountId as number,
    percentage: config.percentage.percent,
    active: config.active ? 1 : 0,
    activatedAtMonth: config.activatedAtMonth,
    createdAt: new Date().toISOString(),
  };
}

export function mapRowToSavingsAllocation(row: SavingsAllocationRow): SavingsAllocation {
  return SavingsAllocation.rehydrate(row.id, {
    accountId: AccountId(row.accountId),
    percentage: SavingsPercentage.fromPercent(row.percentage),
    active: row.active === 1,
    activatedAtMonth: row.activatedAtMonth,
  });
}
