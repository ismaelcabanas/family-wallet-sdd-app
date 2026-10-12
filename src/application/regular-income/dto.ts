import type { RegularIncome } from "@/domain/regular-income/RegularIncome";

export interface RegularIncomeDTO {
  accountId: number;
  amountCents: number;
  dayOfMonth: number;
  note: string;
  active: boolean;
  activatedAtMonth: string;
}

export function toRegularIncomeDTO(config: RegularIncome): RegularIncomeDTO {
  return {
    accountId: config.accountId as number,
    amountCents: config.amount.amountCents,
    dayOfMonth: config.dayOfMonth,
    note: config.note,
    active: config.active,
    activatedAtMonth: config.activatedAtMonth,
  };
}
