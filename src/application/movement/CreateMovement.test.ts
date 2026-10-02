import { AccountNotFoundError } from "@/domain/account/AccountErrors";
import { Account } from "@/domain/account/Account";
import { MemberId } from "@/domain/member/MemberId";
import { InvalidMovementError } from "@/domain/movement/MovementErrors";
import { Movement } from "@/domain/movement/Movement";
import { Tag } from "@/domain/tag/Tag";
import { TagId } from "@/domain/tag/TagId";
import { InactiveTagError, TagNotFoundError } from "@/domain/tag/TagErrors";
import { beforeEach, describe, expect, it } from "vitest";

import type { MovementDTO } from "./dto";
import { CreateMovement } from "./CreateMovement";
import type { MovementRepository } from "./MovementRepository";

class InMemoryMovementRepository implements MovementRepository {
  created: Movement[] = [];

  async create(movement: Movement) {
    this.created.push(movement);
    return movement.id ?? (this.created.length as never);
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

  async findById(): Promise<Movement | null> {
    return null;
  }

  async update(): Promise<void> {}

  async delete(): Promise<void> {}
}

describe("CreateMovement", () => {
  const accounts = [
    Account.rehydrate(1, "Cuenta de Miembro A", "personal", MemberId(1)),
    Account.rehydrate(3, "Cuenta común", "shared", null),
  ];

  const tags = [
    Tag.rehydrate(1, "Alimentación", "alimentacion", "active"),
    Tag.rehydrate(2, "Vivienda", "vivienda", "active"),
    Tag.rehydrate(5, "Inactiva", "inactiva", "inactive"),
    Tag.rehydrate(9, "Sin Clasificar", "sin-clasificar", "active"),
  ];

  let movements: InMemoryMovementRepository;
  let useCase: CreateMovement;

  const baseDto = {
    accountId: 1,
    type: "expense" as const,
    date: "2026-09-01",
    note: "Mercadona",
    amountCents: 12_050,
    nature: "personal" as const,
    tagId: 2,
  };

  beforeEach(() => {
    movements = new InMemoryMovementRepository();
    useCase = new CreateMovement(
      movements,
      {
        findAll: async () => [],
        findById: async (id) => accounts.find((account) => account.id === id) ?? null,
        getBalance: async () => 0,
      },
      {
        findAllActive: async () => tags.filter((tag) => tag.status === "active"),
        findByIds: async (ids) =>
          tags.filter((tag) => tag.id !== null && [...ids].includes(tag.id)),
        findBySlug: async (slug) => tags.find((tag) => tag.slug === slug) ?? null,
      },
    );
  });

  it("crea un gasto válido y lo persiste con su tag única", async () => {
    const id = await useCase.execute({ ...baseDto });
    expect(id).toBe(1);
    expect(movements.created).toHaveLength(1);
    expect(movements.created[0].tagId).toBe(TagId(2));
    expect(movements.created[0].nature).toBe("personal");
  });

  it("crea un ingreso válido sin tag (tag opcional en ingresos)", async () => {
    await useCase.execute({ ...baseDto, type: "income", nature: null, tagId: null });
    expect(movements.created[0].tagId).toBeNull();
    expect(movements.created[0].nature).toBeNull();
  });

  it("aplica naturaleza 'shared' por defecto en gastos de la cuenta común", async () => {
    await useCase.execute({ ...baseDto, accountId: 3, nature: null });
    expect(movements.created[0].nature).toBe("shared");
  });

  it("rechaza un gasto sin tag con el error de dominio propagado", async () => {
    await expect(useCase.execute({ ...baseDto, tagId: null })).rejects.toThrowError(
      InvalidMovementError,
    );
    expect(movements.created).toHaveLength(0);
  });

  it("el error de gasto sin tag señala el campo tagId", async () => {
    const error = await useCase.execute({ ...baseDto, tagId: null }).catch((e) => e);
    expect(error).toBeInstanceOf(InvalidMovementError);
    expect(error.field).toBe("tagId");
    expect(error.message).toBe("Selecciona una etiqueta para el gasto.");
  });

  it("rechaza una tag inexistente", async () => {
    await expect(useCase.execute({ ...baseDto, tagId: 999 })).rejects.toThrowError(
      TagNotFoundError,
    );
    expect(movements.created).toHaveLength(0);
  });

  it("rechaza una tag inactiva", async () => {
    await expect(useCase.execute({ ...baseDto, tagId: 5 })).rejects.toThrowError(
      InactiveTagError,
    );
    expect(movements.created).toHaveLength(0);
  });

  it("rechaza la naturaleza en un ingreso (FR-005)", async () => {
    await expect(
      useCase.execute({ ...baseDto, type: "income", nature: "personal" }),
    ).rejects.toThrowError(InvalidMovementError);
  });

  it("rechaza una cuenta inexistente", async () => {
    await expect(useCase.execute({ ...baseDto, accountId: 999 })).rejects.toThrowError(
      AccountNotFoundError,
    );
    expect(movements.created).toHaveLength(0);
  });
});
