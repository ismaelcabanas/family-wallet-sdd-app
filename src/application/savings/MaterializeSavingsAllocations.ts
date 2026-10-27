import type { AccountId } from "@/domain/account/AccountId";
import type { RegularIncomeRepository } from "../regular-income/RegularIncomeRepository";

import type { SavingsAllocationRepository } from "./SavingsAllocationRepository";

export class MaterializeSavingsAllocations {
  constructor(
    private readonly savingsAllocations: SavingsAllocationRepository,
    private readonly regularIncomes: RegularIncomeRepository,
  ) {}

  async ensureForAccountAndMonth(
    accountId: AccountId,
    month: string,
    currentMonth: string,
  ): Promise<void> {
    const config = await this.savingsAllocations.findByAccountId(accountId);
    if (config === null || !config.active || config.id === null) {
      return;
    }

    if (config.activatedAtMonth > month || month > currentMonth) {
      return;
    }

    if (await this.savingsAllocations.isDeducted(config.id, month)) {
      return;
    }

    const income = await this.regularIncomes.findByAccountId(accountId);
    if (income === null || !income.active) {
      return;
    }

    const amountCents = config.percentage.appliedToCents(income.amount.amountCents);
    if (amountCents < 1) {
      return;
    }

    await this.savingsAllocations.registerDeduction(config, month, amountCents);
  }
}
