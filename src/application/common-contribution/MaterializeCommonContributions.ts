import type { AccountId } from "@/domain/account/AccountId";
import type { AccountRepository } from "../account/AccountRepository";
import type { RegularIncomeRepository } from "../regular-income/RegularIncomeRepository";
import type { TagRepository } from "../tag/TagRepository";
import type { MovementRepository } from "../movement/MovementRepository";
import type { CommonContribution } from "@/domain/common-contribution/CommonContribution";
import type { CommonContributionId } from "@/domain/common-contribution/CommonContributionId";
import type { RegularIncome } from "@/domain/regular-income/RegularIncome";
import { Movement } from "@/domain/movement/Movement";
import { Money } from "@/domain/movement/Money";
import { CONTRIBUTION_TAG_SLUG } from "@/domain/tag/SystemTags";
import { Tag } from "@/domain/tag/Tag";

import type { CommonContributionRepository } from "./CommonContributionRepository";

const CONTRIBUTION_TAG_NAME = "Aportación Común";

export class MaterializeCommonContributions {
  constructor(
    private readonly commonContributions: CommonContributionRepository,
    private readonly regularIncomes: RegularIncomeRepository,
    private readonly movements: MovementRepository,
    private readonly tags: TagRepository,
    private readonly accounts: AccountRepository,
  ) {}

  async ensureForAccountAndMonth(
    accountId: AccountId,
    month: string,
    currentMonth: string,
  ): Promise<void> {
    const config = await this.commonContributions.findByAccountId(accountId);
    if (config === null || config.id === null) {
      return;
    }

    if (config.activatedAtMonth > month || month > currentMonth) {
      return;
    }

    if (await this.commonContributions.isMaterialized(config.id, month)) {
      await this.syncMaterializedMonth(accountId, config, month, currentMonth);
      return;
    }

    if (!config.active) {
      return;
    }

    const income = await this.regularIncomes.findByAccountId(accountId);
    if (income === null || !income.active) {
      return;
    }

    const netCents = await this.netContributionCents(config, accountId, month, income);
    if (netCents < 1) {
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
      amount: Money.fromCents(netCents),
      nature: "personal",
      tagId: tag.id,
    });

    await this.commonContributions.registerMaterialization(config, month, movement);
  }

  private async syncMaterializedMonth(
    accountId: AccountId,
    config: CommonContribution,
    month: string,
    currentMonth: string,
  ): Promise<void> {
    const contributionId = config.id as CommonContributionId;

    if (month !== currentMonth) {
      return;
    }

    const movement = await this.commonContributions.findMaterializedMovement(contributionId, month);
    if (movement === null || movement.id === null) {
      return;
    }

    const income = await this.regularIncomes.findByAccountId(accountId);
    if (income === null || !income.active) {
      return;
    }

    const netCents = await this.netContributionCents(config, accountId, month, income);
    if (netCents < 1) {
      await this.commonContributions.withdrawMaterialization(contributionId, month);
      return;
    }

    if (netCents === movement.amount.amountCents) {
      return;
    }

    await this.movements.update(
      Movement.recreate(
        movement.id,
        {
          accountId: movement.accountId,
          type: movement.type,
          date: movement.date,
          note: movement.note,
          amount: Money.fromCents(netCents),
          nature: movement.nature,
          tagId: movement.tagId,
        },
        movement.createdAt,
      ),
    );
  }

  private async netContributionCents(
    config: CommonContribution,
    accountId: AccountId,
    month: string,
    income: RegularIncome,
  ): Promise<number> {
    const sharedExpenseCents = await this.movements.sumSharedExpenseCents(accountId, month);
    return config.percentage.netAppliedToCents(income.amount.amountCents, sharedExpenseCents);
  }
}
