import { AccountId } from "@/domain/account/AccountId";
import { AccountNotFoundError } from "@/domain/account/AccountErrors";
import {
  CommonContributionNotFoundError,
  ContributionAlreadyExistsError,
  SharedAccountContributionError,
} from "@/domain/common-contribution/CommonContributionErrors";
import { Money } from "@/domain/movement/Money";
import { Movement } from "@/domain/movement/Movement";
import { CONTRIBUTION_TAG_SLUG } from "@/domain/tag/SystemTags";
import { TagNotFoundError } from "@/domain/tag/TagErrors";

import type { AccountRepository } from "../account/AccountRepository";
import type { TagRepository } from "../tag/TagRepository";
import type { RegisterManualContributionDTO } from "./dto";
import type { CommonContributionRepository } from "./CommonContributionRepository";

const DEFAULT_NOTE = "Aportación común";

export class RegisterManualContribution {
  constructor(
    private readonly commonContributions: CommonContributionRepository,
    private readonly accounts: AccountRepository,
    private readonly tags: TagRepository,
  ) {}

  async execute(dto: RegisterManualContributionDTO): Promise<number> {
    const account = await this.accounts.findById(AccountId(dto.accountId));
    if (!account) {
      throw new AccountNotFoundError();
    }
    if (account.type !== "personal") {
      throw new SharedAccountContributionError();
    }

    const config = await this.commonContributions.findByAccountId(
      account.id ?? AccountId(dto.accountId),
    );
    if (config === null || config.id === null || !config.active) {
      throw new CommonContributionNotFoundError(
        "Esta cuenta no tiene configurada la aportación común.",
      );
    }

    const month = dto.date.slice(0, 7);
    const existing = await this.commonContributions.findMaterializedMovement(config.id, month);
    if (existing !== null) {
      throw new ContributionAlreadyExistsError();
    }

    const tag = await this.tags.findBySlug(CONTRIBUTION_TAG_SLUG);
    if (tag === null || tag.id === null) {
      throw new TagNotFoundError();
    }

    const movement = Movement.create({
      accountId: account.id ?? AccountId(dto.accountId),
      type: "expense",
      date: dto.date,
      note: dto.note.trim() === "" ? DEFAULT_NOTE : dto.note.trim(),
      amount: Money.fromCents(dto.amountCents),
      nature: "personal",
      tagId: tag.id,
    });

    const movementId = await this.commonContributions.registerManualContribution(
      config,
      month,
      movement,
    );
    if (movementId === null) {
      throw new ContributionAlreadyExistsError();
    }
    return movementId as number;
  }
}
