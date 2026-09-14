import { MovementId } from "@/domain/movement/MovementId";
import { MovementNotFoundError } from "@/domain/movement/MovementErrors";

import type { MovementRepository } from "./MovementRepository";

export class DeleteMovement {
  constructor(private readonly movements: MovementRepository) {}

  async execute(movementId: number): Promise<void> {
    const id = MovementId(movementId);
    const existing = await this.movements.findById(id);
    if (!existing) {
      throw new MovementNotFoundError();
    }
    await this.movements.delete(id);
  }
}
