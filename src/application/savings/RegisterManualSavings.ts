import { AccountId } from "@/domain/account/AccountId";
import { AccountNotFoundError } from "@/domain/account/AccountErrors";
import { Money } from "@/domain/movement/Money";
import { Movement } from "@/domain/movement/Movement";
import {
  SavingsAllocationNotFoundError,
  SavingsAlreadyExistsError,
  SharedAccountSavingsError,
} from "@/domain/savings/SavingsAllocationErrors";
import { SAVINGS_TAG_SLUG } from "@/domain/tag/SystemTags";
import { TagNotFoundError } from "@/domain/tag/TagErrors";

import type { AccountRepository } from "../account/AccountRepository";
import type { TagRepository } from "../tag/TagRepository";
import type { RegisterManualSavingsDTO } from "./dto";
import type { SavingsAllocationRepository } from "./SavingsAllocationRepository";

const DEFAULT_NOTE = "Ahorro";

export class RegisterManualSavings {
  constructor(
    private readonly savingsAllocations: SavingsAllocationRepository,
    private readonly accounts: AccountRepository,
    private readonly tags: TagRepository,
  ) {}

  async execute(dto: RegisterManualSavingsDTO): Promise<number> {
    const account = await this.accounts.findById(AccountId(dto.accountId));
    if (!account) {
      throw new AccountNotFoundError();
    }
    if (account.type !== "personal") {
      throw new SharedAccountSavingsError();
    }

    const config = await this.savingsAllocations.findByAccountId(
      account.id ?? AccountId(dto.accountId),
    );
    if (config === null || config.id === null) {
      throw new SavingsAllocationNotFoundError();
    }

    const month = dto.date.slice(0, 7);
    const existing = await this.savingsAllocations.findDeductedMovement(config.id, month);
    if (existing !== null) {
      throw new SavingsAlreadyExistsError();
    }

    const tag = await this.tags.findBySlug(SAVINGS_TAG_SLUG);
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

    const movementId = await this.savingsAllocations.registerManualSavings(
      config,
      month,
      movement,
    );
    if (movementId === null) {
      throw new SavingsAlreadyExistsError();
    }
    return movementId as number;
  }
}
