import { Account } from "@/domain/account/Account";
import { AccountId } from "@/domain/account/AccountId";
import { AccountNotFoundError } from "@/domain/account/AccountErrors";
import { MemberId } from "@/domain/member/MemberId";
import { InvalidMovementError, MovementNotFoundError } from "@/domain/movement/MovementErrors";
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
    note: "Mercadona",
    amount: Money.fromCents(8_500),
    nature: "personal",
    tagId: TagId(2),
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
    expectedAccountId: 1,
    type: "expense" as const,
    date: "2026-09-10",
    note: "Mercadona editado",
    amountCents: 7_850,
    nature: "personal" as const,
    tagId: 2,
  };

  beforeEach(() => {
    movements = new InMemoryMovementRepository();
    useCase = new UpdateMovement(movements, accountsRepository, tagsRepository);
  });

  it("actualiza reconstruyendo el movimiento y preservando id, cuenta y createdAt", async () => {
    await useCase.execute({ ...baseDto });

    expect(movements.updated).not.toBeNull();
    expect(movements.updated?.id).toBe(7);
    expect(movements.updated?.createdAt).toBe(ORIGINAL_CREATED_AT);
    expect(movements.updated?.accountId).toBe(1);
    expect(movements.updated?.note).toBe("Mercadona editado");
    expect(movements.updated?.amount.amountCents).toBe(7_850);
    expect(movements.updated?.date).toBe("2026-09-10");
    expect(movements.updated?.tagId).toBe(TagId(2));
  });

  it("permite cambiar la tag del movimiento", async () => {
    await useCase.execute({ ...baseDto, tagId: 3 });

    expect(movements.updated?.tagId).toBe(TagId(3));
  });

  it("lanza MovementNotFoundError si el movimiento no existe", async () => {
    movements.stored = null;

    await expect(useCase.execute({ ...baseDto, movementId: 999 })).rejects.toThrowError(
      MovementNotFoundError,
    );
    expect(movements.updated).toBeNull();
  });

  it("lanza InvalidMovementError de accountId si el movimiento pertenece a otra cuenta", async () => {
    const error = await useCase
      .execute({ ...baseDto, expectedAccountId: 3 })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(InvalidMovementError);
    expect((error as InvalidMovementError).field).toBe("accountId");
    expect((error as InvalidMovementError).message).toBe(
      "El movimiento ya no pertenece a esta cuenta.",
    );
    expect(movements.updated).toBeNull();
  });

  it("lanza AccountNotFoundError si la cuenta del movimiento ya no existe", async () => {
    movements.stored = Movement.rehydrate({
      id: 7,
      accountId: AccountId(999),
      type: "expense",
      date: "2026-09-01",
      note: "Mercadona",
      amount: Money.fromCents(8_500),
      nature: "personal",
      tagId: TagId(2),
      createdAt: ORIGINAL_CREATED_AT,
    });

    await expect(useCase.execute({ ...baseDto, expectedAccountId: 999 })).rejects.toThrowError(
      AccountNotFoundError,
    );
    expect(movements.updated).toBeNull();
  });

  it("resuelve la naturaleza igual que la creación: shared por defecto en cuenta común", async () => {
    movements.stored = Movement.rehydrate({
      id: 7,
      accountId: AccountId(3),
      type: "expense",
      date: "2026-09-01",
      note: "Mercadona",
      amount: Money.fromCents(8_500),
      nature: "shared",
      tagId: TagId(2),
      createdAt: ORIGINAL_CREATED_AT,
    });

    await useCase.execute({ ...baseDto, expectedAccountId: 3, nature: null });

    expect(movements.updated?.nature).toBe("shared");
  });

  it("rechaza una tag inexistente igual que la creación", async () => {
    await expect(useCase.execute({ ...baseDto, tagId: 999 })).rejects.toThrowError(
      TagNotFoundError,
    );
  });

  it("rechaza un gasto sin tag con el error de dominio", async () => {
    await expect(useCase.execute({ ...baseDto, tagId: null })).rejects.toThrowError(
      InvalidMovementError,
    );
    expect(movements.updated).toBeNull();
  });

  it("permite editar un ingreso sin tag", async () => {
    movements.stored = Movement.rehydrate({
      id: 7,
      accountId: AccountId(1),
      type: "income",
      date: "2026-09-01",
      note: "Nómina",
      amount: Money.fromCents(210_000),
      nature: null,
      tagId: null,
      createdAt: ORIGINAL_CREATED_AT,
    });

    await useCase.execute({ ...baseDto, type: "income", nature: null, tagId: null });

    expect(movements.updated?.tagId).toBeNull();
    expect(movements.updated?.nature).toBeNull();
  });

  it("permite cambiar el movimiento de mes dentro de la misma cuenta", async () => {
    await useCase.execute({ ...baseDto, date: "2026-08-20" });

    expect(movements.updated?.accountId).toBe(1);
    expect(movements.updated?.date).toBe("2026-08-20");
    expect(movements.updated?.id).toBe(7);
  });
});
