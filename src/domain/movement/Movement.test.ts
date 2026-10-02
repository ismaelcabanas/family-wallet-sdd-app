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
  note: "Mercadona",
  amount: Money.fromCents(8_500),
  nature: "personal" as const,
  tagId: TagId(1),
};

describe("Movement.create", () => {
  it("crea un gasto válido con naturaleza y tag", () => {
    const movement = Movement.create({ ...validBase });
    expect(movement.id).toBeNull();
    expect(movement.note).toBe("Mercadona");
    expect(movement.nature).toBe("personal");
    expect(movement.tagId).toBe(TagId(1));
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

  it("crea un ingreso sin tag (tag opcional en ingresos)", () => {
    const movement = Movement.create({
      ...validBase,
      type: "income",
      nature: null,
      tagId: null,
    });
    expect(movement.tagId).toBeNull();
  });

  it("crea un ingreso con tag (tag válida también en ingresos)", () => {
    const movement = Movement.create({
      ...validBase,
      type: "income",
      nature: null,
    });
    expect(movement.tagId).toBe(TagId(1));
  });

  it("rechaza un gasto sin naturaleza", () => {
    expect(() => Movement.create({ ...validBase, nature: null })).toThrowError(InvalidMovementError);
  });

  it("rechaza un ingreso con naturaleza", () => {
    expect(() =>
      Movement.create({ ...validBase, type: "income", nature: "personal" }),
    ).toThrowError(InvalidMovementError);
  });

  it("rechaza una nota vacía o con solo espacios", () => {
    expect(() => Movement.create({ ...validBase, note: "   " })).toThrowError(
      InvalidMovementError,
    );
  });

  it("hace trim de la nota", () => {
    const movement = Movement.create({ ...validBase, note: "  Mercadona  " });
    expect(movement.note).toBe("Mercadona");
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

  it("rechaza un gasto sin tag con error de campo tagId", () => {
    try {
      Movement.create({ ...validBase, tagId: null });
      expect.unreachable("debería lanzar InvalidMovementError");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidMovementError);
      expect((error as InvalidMovementError).field).toBe("tagId");
      expect((error as InvalidMovementError).message).toBe("Selecciona una etiqueta para el gasto.");
    }
  });

  it("es inmutable: sus campos son de solo lectura", () => {
    const movement = Movement.create({ ...validBase });
    expect(() => {
      (movement as { note: string }).note = "Otro";
    }).toThrow();
  });

  it("rehydrate restaura un movimiento persistido sin revalidar", () => {
    const movement = Movement.rehydrate({
      id: 7,
      accountId: AccountId(1),
      type: "expense",
      date: "2026-09-01",
      note: "Mercadona",
      amount: Money.fromCents(8_500),
      nature: "shared",
      tagId: TagId(3),
      createdAt: "2026-09-01T10:00:00.000Z",
    });
    expect(movement.id).toBe(7);
    expect(movement.note).toBe("Mercadona");
    expect(movement.tagId).toBe(TagId(3));
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
    expect(movement.note).toBe("Mercadona");
    expect(movement.nature).toBe("personal");
  });

  it("aplica trim de la nota", () => {
    const movement = recreate({ note: "  Mercadona  " });
    expect(movement.note).toBe("Mercadona");
  });

  it.each([
    ["nota vacía", { note: "   " }],
    ["fecha no real", { date: "2026-02-30" }],
    ["importe no positivo", { amount: { amountCents: 0 } as unknown as Money }],
    ["gasto sin naturaleza", { nature: null }],
    ["gasto sin tag", { tagId: null }],
    ["ingreso con naturaleza", { type: "income" as const, nature: "personal" as const }],
  ])("revalida la invariante de %s igual que create", (_case, overrides) => {
    expect(() => recreate(overrides as Partial<typeof validBase>)).toThrowError(
      InvalidMovementError,
    );
  });

  it("permite cambiar el movimiento de mes (la cuenta queda inmutable en la capa de aplicación)", () => {
    const movement = recreate({ date: "2026-08-15" });
    expect(movement.accountId).toBe(1);
    expect(movement.date).toBe("2026-08-15");
    expect(movement.id).toBe(7);
    expect(movement.createdAt).toBe(originalCreatedAt);
  });
});
