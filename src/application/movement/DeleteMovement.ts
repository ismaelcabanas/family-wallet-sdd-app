import { MovementId } from "@/domain/movement/MovementId";
import { MovementNotFoundError } from "@/domain/movement/MovementErrors";

import type { CommonContributionRepository } from "../common-contribution/CommonContributionRepository";
import type { MovementRepository } from "./MovementRepository";

export class DeleteMovement {
  constructor(
    private readonly movements: MovementRepository,
    private readonly commonContributions: CommonContributionRepository,
  ) {}

  async execute(movementId: number): Promise<void> {
    const id = MovementId(movementId);
    const existing = await this.movements.findById(id);
    if (!existing) {
      throw new MovementNotFoundError();
    }
    const withdrew =
      await this.commonContributions.withdrawMaterializationForMovement(id);
    if (!withdrew) {
      await this.movements.delete(id);
    }
  }
}
