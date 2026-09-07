import { AccountId } from "@/domain/account/AccountId";
import { AccountNotFoundError } from "@/domain/account/AccountErrors";
import { InvalidMovementError } from "@/domain/movement/MovementErrors";
import { Money } from "@/domain/movement/Money";
import { Movement } from "@/domain/movement/Movement";
import { TagId } from "@/domain/tag/TagId";
import { InactiveTagError, TagNotFoundError } from "@/domain/tag/TagErrors";

import type { AccountRepository } from "../account/AccountRepository";
import type { TagRepository } from "../tag/TagRepository";
import type { CreateMovementDTO } from "./dto";
import type { MovementRepository } from "./MovementRepository";

export const DEFAULT_TAG_SLUG = "sin-clasificar";

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

    const nature = this.resolveNature(dto, account);
    const tagIds = await this.resolveTagIds(dto.tagIds);

    const movement = Movement.create({
      accountId: account.id ?? AccountId(dto.accountId),
      type: dto.type,
      date: dto.date,
      concept: dto.concept,
      description: dto.description,
      amount: Money.fromCents(dto.amountCents),
      nature,
      tagIds,
    });

    const movementId = await this.movements.create(movement);
    return movementId;
  }

  private resolveNature(dto: CreateMovementDTO, account: { type: string }) {
    if (dto.type === "income") {
      if (dto.nature !== null) {
        throw new InvalidMovementError("nature", "Los ingresos no llevan naturaleza.");
      }
      return null;
    }
    if (dto.nature !== null) {
      return dto.nature;
    }
    if (account.type === "shared") {
      return "shared";
    }
    throw new InvalidMovementError(
      "nature",
      "Selecciona la naturaleza del gasto (personal o compartido).",
    );
  }

  private async resolveTagIds(rawTagIds: number[]): Promise<TagId[]> {
    const uniqueIds = [...new Set(rawTagIds)];

    if (uniqueIds.length === 0) {
      const defaultTag = await this.tags.findBySlug(DEFAULT_TAG_SLUG);
      if (!defaultTag || defaultTag.status !== "active" || defaultTag.id === null) {
        throw new TagNotFoundError();
      }
      return [defaultTag.id];
    }

    const tagIds = uniqueIds.map((id) => TagId(id));
    const found = await this.tags.findByIds(tagIds);
    if (found.length !== tagIds.length) {
      throw new TagNotFoundError();
    }
    if (found.some((tag) => tag.status !== "active")) {
      throw new InactiveTagError();
    }
    return tagIds;
  }
}
