import { AccountId } from "@/domain/account/AccountId";
import { AccountNotFoundError } from "@/domain/account/AccountErrors";
import { Money } from "@/domain/movement/Money";
import { Movement } from "@/domain/movement/Movement";

import type { AccountRepository } from "../account/AccountRepository";
import type { TagRepository } from "../tag/TagRepository";
import type { CreateMovementDTO } from "./dto";
import { resolveNature, resolveTagId } from "./movement-inputs";
import type { MovementRepository } from "./MovementRepository";

export class CreateMovement {
  constructor(
    private readonly movements: MovementRepository,
    private readonly accounts: AccountRepository,
    private readonly tags: TagRepository,
  ) {}

  async execute(dto: CreateMovementDTO): Promise<number> {
    const account = await this.accounts.findById(AccountId(dto.accountId));
    if (!account) {
      throw new AccountNotFoundError();
    }

    const nature = resolveNature(dto, account);
    const tagId = await resolveTagId(this.tags, dto.tagId);

    const movement = Movement.create({
      accountId: account.id ?? AccountId(dto.accountId),
      type: dto.type,
      date: dto.date,
      note: dto.note,
      amount: Money.fromCents(dto.amountCents),
      nature,
      tagId,
    });

    const movementId = await this.movements.create(movement);
    return movementId;
  }
}
