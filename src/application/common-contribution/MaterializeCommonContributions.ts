import type { AccountId } from "@/domain/account/AccountId";
import type { AccountRepository } from "../account/AccountRepository";
import type { RegularIncomeRepository } from "../regular-income/RegularIncomeRepository";
import type { TagRepository } from "../tag/TagRepository";
import { Movement } from "@/domain/movement/Movement";
import { Money } from "@/domain/movement/Money";
import { Tag } from "@/domain/tag/Tag";

import type { CommonContributionRepository } from "./CommonContributionRepository";

const CONTRIBUTION_TAG_SLUG = "aportacion-comun";
const CONTRIBUTION_TAG_NAME = "Aportación Común";

export class MaterializeCommonContributions {
  constructor(
    private readonly commonContributions: CommonContributionRepository,
    private readonly regularIncomes: RegularIncomeRepository,
    private readonly tags: TagRepository,
    private readonly accounts: AccountRepository,
  ) {}

  async ensureForAccountAndMonth(
    accountId: AccountId,
    month: string,
    currentMonth: string,
  ): Promise<void> {
    const config = await this.commonContributions.findByAccountId(accountId);
    if (config === null || !config.active || config.id === null) {
      return;
    }

    if (config.activatedAtMonth > month || month > currentMonth) {
      return;
    }

    if (await this.commonContributions.isMaterialized(config.id, month)) {
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

    const tag =
      (await this.tags.findBySlug(CONTRIBUTION_TAG_SLUG)) ??
      (await this.tags.save(
        Tag.create({ name: CONTRIBUTION_TAG_NAME, slug: CONTRIBUTION_TAG_SLUG, status: "active" }),
      ));

    const accounts = await this.accounts.findAll();
    const account = accounts.find((candidate) => candidate.id === (accountId as number));
    const note = `Aportación común de ${account?.memberName ?? "miembro"}`;

    const movement = Movement.create({
      accountId: config.accountId,
      type: "expense",
      date: config.dueDateForMonth(month),
      note,
      amount: Money.fromCents(amountCents),
      nature: "personal",
      tagId: tag.id,
    });

    await this.commonContributions.registerMaterialization(config, month, movement);
  }
}
