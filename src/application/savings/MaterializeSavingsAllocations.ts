import type { AccountId } from "@/domain/account/AccountId";
import { Money } from "@/domain/movement/Money";
import { Movement } from "@/domain/movement/Movement";
import { SAVINGS_TAG_SLUG } from "@/domain/tag/SystemTags";
import { TagNotFoundError } from "@/domain/tag/TagErrors";
import type { RegularIncomeRepository } from "../regular-income/RegularIncomeRepository";
import type { TagRepository } from "../tag/TagRepository";

import type { SavingsAllocationRepository } from "./SavingsAllocationRepository";

const DEFAULT_NOTE = "Ahorro";

export class MaterializeSavingsAllocations {
  constructor(
    private readonly savingsAllocations: SavingsAllocationRepository,
    private readonly regularIncomes: RegularIncomeRepository,
    private readonly tags: TagRepository,
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

    const tag = await this.tags.findBySlug(SAVINGS_TAG_SLUG);
    if (tag === null || tag.id === null) {
      throw new TagNotFoundError();
    }

    const movement = Movement.create({
      accountId,
      type: "expense",
      date: `${month}-01`,
      note: DEFAULT_NOTE,
      amount: Money.fromCents(amountCents),
      nature: "personal",
      tagId: tag.id,
    });

    await this.savingsAllocations.registerMaterialization(config, month, movement);
  }
}
