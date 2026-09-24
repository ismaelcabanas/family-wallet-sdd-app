import { Account } from "@/domain/account/Account";
import { AccountId } from "@/domain/account/AccountId";
import { AccountNotFoundError } from "@/domain/account/AccountErrors";
import { MemberId } from "@/domain/member/MemberId";
import { MovementNotFoundError } from "@/domain/movement/MovementErrors";
import { Money } from "@/domain/movement/Money";
import { Movement } from "@/domain/movement/Movement";
import { Tag } from "@/domain/tag/Tag";
import { TagId } from "@/domain/tag/TagId";
import { TagNotFoundError } from "@/domain/tag/TagErrors";
import { beforeEach, describe, expect, it } from "vitest";

import type { AccountRepository } from "../account/AccountRepository";
import type { MovementDTO } from "./dto";
import type { MovementRepository } from "./MovementRepository";
import type { TagRepository } from "../tag/TagRepository";
import { UpdateMovement } from "./UpdateMovement";

const ORIGINAL_CREATED_AT = "2026-09-01T08:00:00.000Z";

class InMemoryMovementRepository implements MovementRepository {
  stored: Movement | null = Movement.rehydrate({
    id: 7,
    accountId: AccountId(1),
    type: "expense",
    date: "2026-09-01",
    concept: "Mercadona",
    description: "Compra semanal",
    amount: Money.fromCents(8_500),
    nature: "personal",
    tagIds: [TagId(2)],
    createdAt: ORIGINAL_CREATED_AT,
  });
  updated: Movement | null = null;

  async create(): Promise<never> {
    throw new Error("no esperado en este caso de uso");
  }

  async listByMonthAndAccount(): Promise<MovementDTO[]> {
    return [];
  }

  async listByMonth(): Promise<MovementDTO[]> {
    return [];
  }

  async listByYear(): Promise<MovementDTO[]> {
    return [];
  }

  async findById(id: number) {
    return this.stored?.id === id ? this.stored : null;
  }

  async update(movement: Movement) {
    this.updated = movement;
  }

  async delete(): Promise<void> {}
}

describe("UpdateMovement", () => {
  const accounts = [
    Account.rehydrate(1, "Cuenta de Miembro A", "personal", MemberId(1)),
    Account.rehydrate(3, "Cuenta común", "shared", null),
  ];

  const tags = [
    Tag.rehydrate(1, "Alimentación", "alimentacion", "active"),
    Tag.rehydrate(2, "Vivienda", "vivienda", "active"),
    Tag.rehydrate(3, "Hipoteca", "hipoteca", "active"),
    Tag.rehydrate(9, "Sin Clasificar", "sin-clasificar", "active"),
  ];

  let movements: InMemoryMovementRepository;
  let useCase: UpdateMovement;

  const accountsRepository: AccountRepository = {
    findAll: async () => [],
    findById: async (id) => accounts.find((account) => account.id === id) ?? null,
    getBalance: async () => 0,
  };

  const tagsRepository: TagRepository = {
    findAllActive: async () => tags.filter((tag) => tag.status === "active"),
    findByIds: async (ids) => tags.filter((tag) => tag.id !== null && [...ids].includes(tag.id)),
    findBySlug: async (slug) => tags.find((tag) => tag.slug === slug) ?? null,
  };

  const baseDto = {
    movementId: 7,
    accountId: AccountId(1),
    type: "expense" as const,
    date: "2026-09-10",
    concept: "Mercadona editado",
    description: null,
    amountCents: 7_850,
    nature: "personal" as const,
    tagIds: [2, 3],
  };

  beforeEach(() => {
    movements = new InMemoryMovementRepository();
    useCase = new UpdateMovement(movements, accountsRepository, tagsRepository);
  });

  it("actualiza reconstruyendo el movimiento y preservando id y createdAt", async () => {
    await useCase.execute({ ...baseDto });

    expect(movements.updated).not.toBeNull();
    expect(movements.updated?.id).toBe(7);
    expect(movements.updated?.createdAt).toBe(ORIGINAL_CREATED_AT);
    expect(movements.updated?.concept).toBe("Mercadona editado");
    expect(movements.updated?.amount.amountCents).toBe(7_850);
    expect(movements.updated?.date).toBe("2026-09-10");
  });

  it("lanza MovementNotFoundError si el movimiento no existe", async () => {
    movements.stored = null;

    await expect(useCase.execute({ ...baseDto, movementId: 999 })).rejects.toThrowError(
      MovementNotFoundError,
    );
    expect(movements.updated).toBeNull();
  });

  it("lanza AccountNotFoundError si la cuenta destino no existe", async () => {
    await expect(useCase.execute({ ...baseDto, accountId: 999 })).rejects.toThrowError(
      AccountNotFoundError,
    );
    expect(movements.updated).toBeNull();
  });

  it("resuelve la naturaleza igual que la creación: shared por defecto en cuenta común", async () => {
    await useCase.execute({ ...baseDto, accountId: 3, nature: null });

    expect(movements.updated?.nature).toBe("shared");
  });

  it("resuelve las tags igual que la creación: 'Sin Clasificar' si no se selecciona ninguna", async () => {
    await useCase.execute({ ...baseDto, tagIds: [] });

    expect([...(movements.updated?.tagIds ?? [])]).toEqual([TagId(9)]);
  });

  it("resuelve las tags igual que la creación: rechaza una tag inexistente", async () => {
    await expect(useCase.execute({ ...baseDto, tagIds: [999] })).rejects.toThrowError(
      TagNotFoundError,
    );
  });

  it("permite mover el movimiento a otra cuenta y mes (FR-005)", async () => {
    await useCase.execute({ ...baseDto, accountId: 3, date: "2026-08-20", nature: null });

    expect(movements.updated?.accountId).toBe(3);
    expect(movements.updated?.date).toBe("2026-08-20");
    expect(movements.updated?.id).toBe(7);
  });
});
