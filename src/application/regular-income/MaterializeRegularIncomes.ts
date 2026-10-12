import type { AccountId } from "@/domain/account/AccountId";
import { Movement } from "@/domain/movement/Movement";

import type { RegularIncomeRepository } from "./RegularIncomeRepository";

export class MaterializeRegularIncomes {
  constructor(private readonly regularIncomes: RegularIncomeRepository) {}

  async ensureForAccountAndMonth(
    accountId: AccountId,
    month: string,
    currentMonth: string,
  ): Promise<void> {
    const config = await this.regularIncomes.findByAccountId(accountId);
    if (config === null || !config.active || config.id === null) {
      return;
    }

    if (config.activatedAtMonth > month || month > currentMonth) {
      return;
    }

    if (await this.regularIncomes.isMaterialized(config.id, month)) {
      return;
    }

    const movement = Movement.create({
      accountId: config.accountId,
      type: "income",
      date: config.dueDateForMonth(month),
      note: config.note,
      amount: config.amount,
      nature: null,
      tagId: null,
    });

    await this.regularIncomes.registerMaterialization(config, month, movement);
  }
}
