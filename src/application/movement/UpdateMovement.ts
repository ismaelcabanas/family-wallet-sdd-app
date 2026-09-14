import { AccountId } from "@/domain/account/AccountId";
import { AccountNotFoundError } from "@/domain/account/AccountErrors";
import { Money } from "@/domain/movement/Money";
import { Movement } from "@/domain/movement/Movement";
import { MovementId } from "@/domain/movement/MovementId";
import { MovementNotFoundError } from "@/domain/movement/MovementErrors";

import type { AccountRepository } from "../account/AccountRepository";
import type { TagRepository } from "../tag/TagRepository";
import type { UpdateMovementDTO } from "./dto";
import { resolveNature, resolveTagIds } from "./movement-inputs";
import type { MovementRepository } from "./MovementRepository";

export class UpdateMovement {
  constructor(
    private readonly movements: MovementRepository,
    private readonly accounts: AccountRepository,
    private readonly tags: TagRepository,
  ) {}

  async execute(dto: UpdateMovementDTO): Promise<void> {
    const existing = await this.movements.findById(MovementId(dto.movementId));
    if (!existing) {
      throw new MovementNotFoundError();
    }

    const account = await this.accounts.findById(AccountId(dto.accountId));
    if (!account) {
      throw new AccountNotFoundError();
    }

    const nature = resolveNature(dto, account);
    const tagIds = await resolveTagIds(this.tags, dto.tagIds);

    const movement = Movement.recreate(
      MovementId(dto.movementId),
      {
        accountId: account.id ?? AccountId(dto.accountId),
        type: dto.type,
        date: dto.date,
        concept: dto.concept,
        description: dto.description,
        amount: Money.fromCents(dto.amountCents),
        nature,
        tagIds,
      },
      existing.createdAt,
    );

    await this.movements.update(movement);
  }
}
