import type { AccountId } from "@/domain/account/AccountId";
import { InvalidMovementError } from "@/domain/movement/MovementErrors";
import type { Movement } from "@/domain/movement/Movement";
import type { MovementId } from "@/domain/movement/MovementId";
import { Tag } from "@/domain/tag/Tag";
import { InactiveTagError, ProtectedTagError, TagNotFoundError } from "@/domain/tag/TagErrors";
import type { TagId } from "@/domain/tag/TagId";
import { TagCategoryId } from "@/domain/tag-category/TagCategoryId";
import { describe, expect, it } from "vitest";

import type { TagRepository } from "../tag/TagRepository";
import { BulkRetagMovements } from "./BulkRetagMovements";
import type { MovementDTO } from "./dto";
import type { MovementRepository } from "./MovementRepository";

interface StoredMovement {
  id: number;
  accountId: number;
  date: string;
  tagId: number | null;
}

class InMemoryMovementRepository implements MovementRepository {
  readonly retagCalls: {
    accountId: AccountId;
    month: string;
    movementIds: MovementId[];
    targetTagId: TagId;
  }[] = [];

  constructor(readonly stored: StoredMovement[]) {}

  async retagMovements(
    accountId: AccountId,
    month: string,
    movementIds: readonly MovementId[],
    targetTagId: TagId,
  ): Promise<{ updated: number }> {
    this.retagCalls.push({ accountId, month, movementIds: [...movementIds], targetTagId });

    let updated = 0;
    for (const movement of this.stored) {
      const inMonth = movement.accountId === (accountId as number) && movement.date.startsWith(`${month}-`);
      if (inMonth && movementIds.includes(movement.id as MovementId)) {
        movement.tagId = targetTagId as number;
        updated += 1;
      }
    }
    return { updated };
  }

  async create(): Promise<MovementId> {
    throw new Error("No usado en este test");
  }
  async listByMonthAndAccount(): Promise<MovementDTO[]> {
    throw new Error("No usado en este test");
  }
  async listByMonth(): Promise<MovementDTO[]> {
    throw new Error("No usado en este test");
  }
  async listByYear(): Promise<MovementDTO[]> {
    throw new Error("No usado en este test");
  }
  async findById(): Promise<Movement | null> {
    throw new Error("No usado en este test");
  }
  async update(): Promise<void> {
    throw new Error("No usado en este test");
  }
  async delete(): Promise<void> {
    throw new Error("No usado en este test");
  }
  async sumSharedExpenseCents(): Promise<number> {
    throw new Error("No usado en este test");
  }
}

class InMemoryTagRepository implements TagRepository {
  constructor(readonly stored: Tag[]) {}

  async findById(id: TagId): Promise<Tag | null> {
    return this.stored.find((tag) => tag.id === id) ?? null;
  }

  async findAllActive(): Promise<Tag[]> {
    throw new Error("No usado en este test");
  }
  async findByIds(): Promise<Tag[]> {
    throw new Error("No usado en este test");
  }
  async findBySlug(): Promise<Tag | null> {
    throw new Error("No usado en este test");
  }
  async findByName(): Promise<Tag | null> {
    throw new Error("No usado en este test");
  }
  async save(): Promise<Tag> {
    throw new Error("No usado en este test");
  }
  async findAll(): Promise<Tag[]> {
    throw new Error("No usado en este test");
  }
  async update(): Promise<Tag> {
    throw new Error("No usado en este test");
  }
  async mergeInto(): Promise<{ reassignedMovements: number }> {
    throw new Error("No usado en este test");
  }
}

function activeTag(id: number, slug = "ocio"): Tag {
  return Tag.rehydrate(id, "Ocio", slug, "active", TagCategoryId(1));
}

function buildUseCase(stored: StoredMovement[], tags: Tag[]): {
  useCase: BulkRetagMovements;
  movements: InMemoryMovementRepository;
} {
  const movements = new InMemoryMovementRepository(stored);
  const useCase = new BulkRetagMovements(movements, new InMemoryTagRepository(tags));
  return { useCase, movements };
}

describe("BulkRetagMovements", () => {
  it("reasigna los ids deduplicados y devuelve el recuento sin descartes", async () => {
    const stored: StoredMovement[] = [
      { id: 1, accountId: 2, date: "2026-02-05", tagId: 3 },
      { id: 2, accountId: 2, date: "2026-02-10", tagId: 3 },
      { id: 3, accountId: 2, date: "2026-02-20", tagId: 3 },
    ];
    const { useCase, movements: repo } = buildUseCase(stored, [activeTag(5)]);

    const result = await useCase.execute({
      accountId: 2,
      month: "2026-02",
      movementIds: [1, 2, 2, 3],
      targetTagId: 5,
    });

    expect(result).toEqual({ updatedCount: 3, skippedCount: 0 });
    expect(repo.retagCalls).toHaveLength(1);
    expect(repo.retagCalls[0].movementIds).toEqual([1, 2, 3]);
  });

  it("selección vacía tras deduplicar lanza InvalidMovementError con el mensaje congelado", async () => {
    const { useCase } = buildUseCase([], [activeTag(5)]);

    await expect(
      useCase.execute({ accountId: 2, month: "2026-02", movementIds: [], targetTagId: 5 }),
    ).rejects.toThrowError(new InvalidMovementError("movementIds", "Selecciona al menos un movimiento."));
  });

  it("destino inexistente lanza TagNotFoundError sin tocar el puerto de movimientos", async () => {
    const { useCase, movements: repo } = buildUseCase([{ id: 1, accountId: 2, date: "2026-02-05", tagId: 3 }], []);

    await expect(
      useCase.execute({ accountId: 2, month: "2026-02", movementIds: [1], targetTagId: 5 }),
    ).rejects.toThrowError(new TagNotFoundError());
    expect(repo.retagCalls).toHaveLength(0);
  });

  it("destino inactivo lanza el error de etiqueta inactiva (semántica resolveTagId)", async () => {
    const inactive = Tag.rehydrate(5, "Vieja", "vieja", "inactive", TagCategoryId(1));
    const { useCase, movements: repo } = buildUseCase([{ id: 1, accountId: 2, date: "2026-02-05", tagId: 3 }], [inactive]);

    await expect(
      useCase.execute({ accountId: 2, month: "2026-02", movementIds: [1], targetTagId: 5 }),
    ).rejects.toThrowError(new InactiveTagError());
    expect(repo.retagCalls).toHaveLength(0);
  });

  it("destino protegido (slug aportacion-comun) lanza ProtectedTagError", async () => {
    const protectedTag = Tag.rehydrate(100, "Aportación Común", "aportacion-comun", "active", TagCategoryId(1));
    const { useCase, movements: repo } = buildUseCase([{ id: 1, accountId: 2, date: "2026-02-05", tagId: 3 }], [protectedTag]);

    await expect(
      useCase.execute({ accountId: 2, month: "2026-02", movementIds: [1], targetTagId: 100 }),
    ).rejects.toThrowError(new ProtectedTagError("Aportación Común"));
    expect(repo.retagCalls).toHaveLength(0);
  });

  it("ids ajenos a la cuenta o al mes computan como descartes (ignorar con aviso)", async () => {
    const stored: StoredMovement[] = [
      { id: 1, accountId: 2, date: "2026-02-05", tagId: 3 },
      { id: 2, accountId: 2, date: "2026-02-10", tagId: 3 },
    ];
    const { useCase } = buildUseCase(stored, [activeTag(5)]);

    const result = await useCase.execute({
      accountId: 2,
      month: "2026-02",
      movementIds: [1, 2, 999],
      targetTagId: 5,
    });

    expect(result).toEqual({ updatedCount: 2, skippedCount: 1 });
  });

  it("un único id válido se reasigna con recuento 1 y sin descartes", async () => {
    const { useCase } = buildUseCase([{ id: 2, accountId: 2, date: "2026-02-10", tagId: 3 }], [activeTag(5)]);

    const result = await useCase.execute({
      accountId: 2,
      month: "2026-02",
      movementIds: [2],
      targetTagId: 5,
    });

    expect(result).toEqual({ updatedCount: 1, skippedCount: 0 });
  });
});
