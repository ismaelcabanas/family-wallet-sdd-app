import { AccountId } from "@/domain/account/AccountId";
import { AccountNotFoundError } from "@/domain/account/AccountErrors";
import { Money } from "@/domain/movement/Money";
import { Movement } from "@/domain/movement/Movement";
import { MovementId } from "@/domain/movement/MovementId";
import { InvalidMovementError, MovementNotFoundError } from "@/domain/movement/MovementErrors";

import type { AccountRepository } from "../account/AccountRepository";
import type { CommonContributionRepository } from "../common-contribution/CommonContributionRepository";
import type { SavingsAllocationRepository } from "../savings/SavingsAllocationRepository";
import type { TagRepository } from "../tag/TagRepository";
import type { UpdateMovementDTO } from "./dto";
import { resolveNature, resolveTagId } from "./movement-inputs";
import type { MovementRepository } from "./MovementRepository";

export class UpdateMovement {
  constructor(
    private readonly movements: MovementRepository,
    private readonly accounts: AccountRepository,
    private readonly tags: TagRepository,
    private readonly commonContributions: CommonContributionRepository,
    private readonly savingsAllocations: SavingsAllocationRepository,
  ) {}

  async execute(dto: UpdateMovementDTO): Promise<void> {
    const existing = await this.movements.findById(MovementId(dto.movementId));
    if (!existing) {
      throw new MovementNotFoundError();
    }

    if ((existing.accountId as number) !== dto.expectedAccountId) {
      throw new InvalidMovementError("accountId", "El movimiento ya no pertenece a esta cuenta.");
    }

    const account = await this.accounts.findById(AccountId(dto.expectedAccountId));
    if (!account) {
      throw new AccountNotFoundError();
    }

    const isContributionMovement =
      (await this.commonContributions.findMaterializedMonthByMovement(MovementId(dto.movementId))) !==
      null;
    const isSavingsMovement = isContributionMovement
      ? false
      : (await this.savingsAllocations.findDeductedMonthByMovement(MovementId(dto.movementId))) !==
        null;
    const hasFrozenIdentity = isContributionMovement || isSavingsMovement;

    const nature = hasFrozenIdentity ? existing.nature : resolveNature(dto, account);
    const tagId = hasFrozenIdentity ? existing.tagId : await resolveTagId(this.tags, dto.tagId);

    const movement = Movement.recreate(
      MovementId(dto.movementId),
      {
        accountId: existing.accountId,
        type: hasFrozenIdentity ? existing.type : dto.type,
        date: dto.date,
        note: dto.note,
        amount: Money.fromCents(dto.amountCents),
        nature,
        tagId,
      },
      existing.createdAt,
    );

    await this.movements.update(movement);
  }
}
