import { AccountId } from "@/domain/account/AccountId";
import { MovementNotFoundError } from "@/domain/movement/MovementErrors";
import { Money } from "@/domain/movement/Money";
import { Movement } from "@/domain/movement/Movement";
import { TagId } from "@/domain/tag/TagId";
import { beforeEach, describe, expect, it } from "vitest";

import type { MovementDTO } from "./dto";
import { DeleteMovement } from "./DeleteMovement";
import type { MovementRepository } from "./MovementRepository";

class InMemoryMovementRepository implements MovementRepository {
  stored: Movement | null = Movement.rehydrate({
    id: 7,
    accountId: AccountId(1),
    type: "expense",
    date: "2026-09-01",
    concept: "Mercadona",
    description: null,
    amount: Money.fromCents(8_500),
    nature: "personal",
    tagIds: [TagId(2)],
    createdAt: "2026-09-01T08:00:00.000Z",
  });
  deletedId: number | null = null;

  async create(): Promise<never> {
    throw new Error("no esperado en este caso de uso");
  }

  async listByMonthAndAccount(): Promise<MovementDTO[]> {
    return [];
  }

  async findById(id: number) {
    return this.stored?.id === id ? this.stored : null;
  }

  async update(): Promise<void> {}

  async delete(id: number) {
    this.deletedId = id;
  }
}

describe("DeleteMovement", () => {
  let movements: InMemoryMovementRepository;
  let useCase: DeleteMovement;

  beforeEach(() => {
    movements = new InMemoryMovementRepository();
    useCase = new DeleteMovement(movements);
  });

  it("elimina el movimiento por su id cuando existe", async () => {
    await useCase.execute(7);

    expect(movements.deletedId).toBe(7);
  });

  it("lanza MovementNotFoundError si el movimiento no existe", async () => {
    movements.stored = null;

    await expect(useCase.execute(999)).rejects.toThrowError(MovementNotFoundError);
    expect(movements.deletedId).toBeNull();
  });
});
