import { AccountId } from "@/domain/account/AccountId";
import { InvalidMovementError } from "@/domain/movement/MovementErrors";
import { MovementId } from "@/domain/movement/MovementId";
import { InactiveTagError, ProtectedTagError, TagNotFoundError } from "@/domain/tag/TagErrors";
import { TagId } from "@/domain/tag/TagId";
import { isProtectedTagSlug } from "@/domain/tag/SystemTags";

import type { TagRepository } from "../tag/TagRepository";
import type { BulkRetagInputDTO, BulkRetagResultDTO } from "./dto";
import type { MovementRepository } from "./MovementRepository";

export class BulkRetagMovements {
  constructor(
    private readonly movements: MovementRepository,
    private readonly tags: TagRepository,
  ) {}

  async execute(input: BulkRetagInputDTO): Promise<BulkRetagResultDTO> {
    const movementIds = Array.from(new Set(input.movementIds)).map((id) => MovementId(id));
    if (movementIds.length === 0) {
      throw new InvalidMovementError("movementIds", "Selecciona al menos un movimiento.");
    }

    const targetTagId = TagId(input.targetTagId);
    const targetTag = await this.tags.findById(targetTagId);
    if (targetTag === null) {
      throw new TagNotFoundError();
    }
    if (targetTag.status !== "active") {
      throw new InactiveTagError();
    }
    if (isProtectedTagSlug(targetTag.slug)) {
      throw new ProtectedTagError(targetTag.name);
    }

    const { updated } = await this.movements.retagMovements(
      AccountId(input.accountId),
      input.month,
      movementIds,
      targetTagId,
    );

    return { updatedCount: updated, skippedCount: movementIds.length - updated };
  }
}
