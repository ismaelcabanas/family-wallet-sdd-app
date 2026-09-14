import { describe, expect, it } from "vitest";

import { AccountId } from "../account/AccountId";
import { TagId } from "../tag/TagId";
import { InvalidMoneyError, InvalidMovementError } from "./MovementErrors";
import { Money } from "./Money";
import { Movement, type MovementInput } from "./Movement";
import { MovementId } from "./MovementId";

const validBase = {
  accountId: AccountId(1),
  type: "expense" as const,
  date: "2026-09-01",
  concept: "Mercadona",
  description: null,
  amount: Money.fromCents(8_500),
  nature: "personal" as const,
  tagIds: [TagId(1), TagId(2)],
};

describe("Movement.create", () => {
  it("crea un gasto válido con naturaleza y tags", () => {
    const movement = Movement.create({ ...validBase });
    expect(movement.id).toBeNull();
    expect(movement.concept).toBe("Mercadona");
    expect(movement.nature).toBe("personal");
    expect(movement.tagIds).toHaveLength(2);
    expect(movement.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("crea un ingreso sin naturaleza", () => {
    const movement = Movement.create({
      ...validBase,
      type: "income",
      nature: null,
    });
    expect(movement.type).toBe("income");
    expect(movement.nature).toBeNull();
  });

  it("rechaza un gasto sin naturaleza", () => {
    expect(() => Movement.create({ ...validBase, nature: null })).toThrowError(InvalidMovementError);
  });

  it("rechaza un ingreso con naturaleza", () => {
    expect(() =>
      Movement.create({ ...validBase, type: "income", nature: "personal" }),
    ).toThrowError(InvalidMovementError);
  });

  it("rechaza un concepto vacío o con solo espacios", () => {
    expect(() => Movement.create({ ...validBase, concept: "   " })).toThrowError(
      InvalidMovementError,
    );
  });

  it("hace trim del concepto", () => {
    const movement = Movement.create({ ...validBase, concept: "  Mercadona  " });
    expect(movement.concept).toBe("Mercadona");
  });

  it("rechaza fechas que no son de calendario real (2026-02-30)", () => {
    expect(() => Movement.create({ ...validBase, date: "2026-02-30" })).toThrowError(
      InvalidMovementError,
    );
  });

  it("rechaza el 29 de febrero en años no bisiestos", () => {
    expect(() => Movement.create({ ...validBase, date: "2026-02-29" })).toThrowError(
      InvalidMovementError,
    );
  });

  it("acepta el 29 de febrero en años bisiestos", () => {
    const movement = Movement.create({ ...validBase, date: "2024-02-29" });
    expect(movement.date).toBe("2024-02-29");
  });

  it("rechaza formatos de fecha no ISO", () => {
    expect(() => Movement.create({ ...validBase, date: "01/09/2026" })).toThrowError(
      InvalidMovementError,
    );
  });

  it("rechaza tagIds vacías", () => {
    expect(() => Movement.create({ ...validBase, tagIds: [] })).toThrowError(InvalidMovementError);
  });

  it("deduplica tagIds repetidas", () => {
    const movement = Movement.create({
      ...validBase,
      tagIds: [TagId(1), TagId(2), TagId(1)],
    });
    expect(movement.tagIds.map((tagId) => tagId as number)).toEqual([1, 2]);
  });

  it("es inmutable: sus campos son de solo lectura", () => {
    const movement = Movement.create({ ...validBase });
    expect(Object.isFrozen(movement.tagIds)).toBe(true);
    expect(() => {
      (movement as { concept: string }).concept = "Otro";
    }).toThrow();
  });

  it("rehydrate restaura un movimiento persistido sin revalidar", () => {
    const movement = Movement.rehydrate({
      id: 7,
      accountId: AccountId(1),
      type: "expense",
      date: "2026-09-01",
      concept: "Mercadona",
      description: "Compra semanal",
      amount: Money.fromCents(8_500),
      nature: "shared",
      tagIds: [TagId(3)],
      createdAt: "2026-09-01T10:00:00.000Z",
    });
    expect(movement.id).toBe(7);
    expect(movement.description).toBe("Compra semanal");
  });

  it("el importe inválido se rechaza en el VO Money antes de crear el movimiento", () => {
    expect(() => Money.fromCents(0)).toThrowError(InvalidMoneyError);
  });
});

describe("Movement.recreate", () => {
  const originalCreatedAt = "2026-08-01T10:00:00.000Z";

  function recreate(overrides: Partial<MovementInput> = {}) {
    return Movement.recreate(
      MovementId(7),
      { ...validBase, ...overrides },
      originalCreatedAt,
    );
  }

  it("reconstruye un movimiento válido preservando id y createdAt", () => {
    const movement = recreate();
    expect(movement.id).toBe(7);
    expect(movement.createdAt).toBe(originalCreatedAt);
    expect(movement.concept).toBe("Mercadona");
    expect(movement.nature).toBe("personal");
  });

  it("aplica trim del concepto y normaliza la descripción vacía a null", () => {
    const movement = recreate({ concept: "  Mercadona  ", description: "   " });
    expect(movement.concept).toBe("Mercadona");
    expect(movement.description).toBeNull();
  });

  it.each([
    ["concepto vacío", { concept: "   " }],
    ["fecha no real", { date: "2026-02-30" }],
    ["importe no positivo", { amount: { amountCents: 0 } as unknown as Money }],
    ["gasto sin naturaleza", { nature: null }],
    ["ingreso con naturaleza", { type: "income" as const, nature: "personal" as const }],
    ["cero tags", { tagIds: [] }],
  ])("revalida la invariante de %s igual que create", (_case, overrides) => {
    expect(() => recreate(overrides as Partial<typeof validBase>)).toThrowError(
      InvalidMovementError,
    );
  });

  it("permite cambiar el movimiento de cuenta y de mes (FR-005)", () => {
    const movement = recreate({
      accountId: AccountId(3),
      date: "2026-08-15",
    });
    expect(movement.accountId).toBe(3);
    expect(movement.date).toBe("2026-08-15");
    expect(movement.id).toBe(7);
    expect(movement.createdAt).toBe(originalCreatedAt);
  });

  it("deduplica tags repetidas", () => {
    const movement = recreate({ tagIds: [TagId(1), TagId(2), TagId(1)] });
    expect(movement.tagIds.map((tagId) => tagId as number)).toEqual([1, 2]);
  });
});
