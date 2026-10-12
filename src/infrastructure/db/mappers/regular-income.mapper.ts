import { Money } from "@/domain/movement/Money";
import { RegularIncome } from "@/domain/regular-income/RegularIncome";
import { RegularIncomeId } from "@/domain/regular-income/RegularIncomeId";
import { AccountId } from "@/domain/account/AccountId";

import type { NewRegularIncomeRow, RegularIncomeRow } from "../schema/regular-incomes";

export function mapRegularIncomeToRow(config: RegularIncome): NewRegularIncomeRow {
  return {
    ...(config.id === null ? {} : { id: config.id as number }),
    accountId: config.accountId as number,
    amountCents: config.amount.amountCents,
    dayOfMonth: config.dayOfMonth,
    note: config.note,
    active: config.active ? 1 : 0,
    activatedAtMonth: config.activatedAtMonth,
    createdAt: new Date().toISOString(),
  };
}

export function mapRowToRegularIncome(row: RegularIncomeRow): RegularIncome {
  return RegularIncome.rehydrate({
    id: RegularIncomeId(row.id),
    accountId: AccountId(row.accountId),
    amount: Money.fromCents(row.amountCents),
    dayOfMonth: row.dayOfMonth,
    note: row.note,
    active: row.active === 1,
    activatedAtMonth: row.activatedAtMonth,
  });
}
