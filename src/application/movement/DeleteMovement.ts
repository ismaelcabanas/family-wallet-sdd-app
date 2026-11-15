import { MovementId } from "@/domain/movement/MovementId";
import { MovementNotFoundError } from "@/domain/movement/MovementErrors";

import type { CommonContributionRepository } from "../common-contribution/CommonContributionRepository";
import type { SavingsAllocationRepository } from "../savings/SavingsAllocationRepository";
import type { MovementRepository } from "./MovementRepository";

export class DeleteMovement {
  constructor(
    private readonly movements: MovementRepository,
    private readonly commonContributions: CommonContributionRepository,
    private readonly savingsAllocations: SavingsAllocationRepository,
  ) {}

  async execute(movementId: number): Promise<void> {
    const id = MovementId(movementId);
    const existing = await this.movements.findById(id);
    if (!existing) {
      throw new MovementNotFoundError();
    }
    const withdrewContribution =
      await this.commonContributions.withdrawMaterializationForMovement(id);
    if (withdrewContribution) {
      return;
    }
    const withdrewSavings = await this.savingsAllocations.withdrawDeductionForMovement(id);
    if (!withdrewSavings) {
      await this.movements.delete(id);
    }
  }
}
