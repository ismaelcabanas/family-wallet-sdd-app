import { AccountId } from "@/domain/account/AccountId";
import { TagId } from "@/domain/tag/TagId";
import { Movement } from "@/domain/movement/Movement";
import { MovementId } from "@/domain/movement/MovementId";
import { Money } from "@/domain/movement/Money";
import { beforeEach, describe, expect, it } from "vitest";

import { DrizzleMovementRepository } from "./DrizzleMovementRepository";
import { accounts } from "./schema/accounts";
import { members } from "./schema/members";
import { movements } from "./schema/movements";
import { tags } from "./schema/tags";
import { createTestDb, type TestDb } from "./test-support";

let testDb: TestDb;

beforeEach(async () => {
  testDb = await createTestDb();
  await testDb.db.insert(members).values({ id: 1, name: "Miembro A" });
  await testDb.db.insert(accounts).values([
    { id: 1, name: "Cuenta de Miembro A", type: "personal", memberId: 1 },
    { id: 3, name: "Cuenta común", type: "shared", memberId: null },
  ]);
  await testDb.db.insert(tags).values([
    { id: 2, name: "Vivienda", slug: "vivienda", status: "active" },
    { id: 3, name: "Hipoteca", slug: "hipoteca", status: "active" },
  ]);
});

function buildMovement(overrides: Partial<Parameters<typeof Movement.create>[0]> = {}) {
  return Movement.create({
    accountId: AccountId(3),
    type: "expense",
    date: "2026-09-15",
    note: "Hipoteca",
    amount: Money.fromCents(85_000),
    nature: "shared",
    tagId: TagId(2),
    ...overrides,
  });
}

describe("DrizzleMovementRepository", () => {
  it("crea el movimiento con su tag única en la propia fila", async () => {
    const repository = new DrizzleMovementRepository(testDb.db);
    const movement = buildMovement();

    const movementId = await repository.create(movement);

    expect(movementId).toBe(1);
    const [storedMovement] = await testDb.db.select().from(movements);
    expect(storedMovement.note).toBe("Hipoteca");
    expect(storedMovement.amountCents).toBe(85_000);
    expect(storedMovement.nature).toBe("shared");
    expect(storedMovement.tagId).toBe(2);
  });

  it("crea un ingreso sin tag (tag_id null)", async () => {
    const repository = new DrizzleMovementRepository(testDb.db);
    await repository.create(
      buildMovement({ type: "income", nature: null, tagId: null, note: "Nómina" }),
    );

    const [storedMovement] = await testDb.db.select().from(movements);
    expect(storedMovement.tagId).toBeNull();
  });

  it("lista por mes y cuenta con rango semicerrado [mes-01, mesSiguiente-01)", async () => {
    const repository = new DrizzleMovementRepository(testDb.db);
    await repository.create(buildMovement({ date: "2026-09-01" }));
    await repository.create(buildMovement({ date: "2026-09-30", note: "Fin de mes" }));
    await repository.create(buildMovement({ date: "2026-10-01", note: "Mes siguiente" }));
    await repository.create(buildMovement({ date: "2026-08-31", note: "Mes anterior" }));
    await repository.create(
      buildMovement({ accountId: AccountId(1), date: "2026-09-15", note: "Otra cuenta" }),
    );

    const result = await repository.listByMonthAndAccount(AccountId(3), "2026-09");

    expect(result.map((movement) => movement.note)).toEqual(["Fin de mes", "Hipoteca"]);
  });

  it("incluye la tag única de cada movimiento en el listado", async () => {
    const repository = new DrizzleMovementRepository(testDb.db);
    await repository.create(buildMovement());

    const [movement] = await repository.listByMonthAndAccount(AccountId(3), "2026-09");

    expect(movement.tag).toEqual({ id: 2, name: "Vivienda", slug: "vivienda" });
  });

  it("la tag del DTO es null para un movimiento sin tag", async () => {
    const repository = new DrizzleMovementRepository(testDb.db);
    await repository.create(
      buildMovement({ type: "income", nature: null, tagId: null, note: "Nómina" }),
    );

    const [movement] = await repository.listByMonthAndAccount(AccountId(3), "2026-09");

    expect(movement.tag).toBeNull();
  });

  it("cubre febrero y años bisiestos por construcción", async () => {
    const repository = new DrizzleMovementRepository(testDb.db);
    await repository.create(buildMovement({ date: "2024-02-29", note: "Bisiesto" }));
    await repository.create(buildMovement({ date: "2024-03-01", note: "Marzo" }));

    const february = await repository.listByMonthAndAccount(AccountId(3), "2024-02");

    expect(february.map((movement) => movement.note)).toEqual(["Bisiesto"]);
  });

  it("ordena por fecha descendente dentro del mes", async () => {
    const repository = new DrizzleMovementRepository(testDb.db);
    await repository.create(buildMovement({ date: "2026-09-02", note: "Antiguo" }));
    await repository.create(buildMovement({ date: "2026-09-28", note: "Reciente" }));

    const result = await repository.listByMonthAndAccount(AccountId(3), "2026-09");

    expect(result.map((movement) => movement.note)).toEqual(["Reciente", "Antiguo"]);
  });

  it("filtra solo por la fecha del movimiento, no por la de creación (FR-004)", async () => {
    const repository = new DrizzleMovementRepository(testDb.db);
    await repository.create(buildMovement({ date: "2026-08-10", note: "Movimiento de otro mes" }));

    const currentMonth = await repository.listByMonthAndAccount(AccountId(3), "2026-09");
    const previousMonth = await repository.listByMonthAndAccount(AccountId(3), "2026-08");

    expect(currentMonth).toHaveLength(0);
    expect(previousMonth.map((movement) => movement.note)).toEqual(["Movimiento de otro mes"]);
  });

  describe("listByMonth", () => {
    it("devuelve los movimientos de todas las cuentas del mes con su tag", async () => {
      await testDb.db.insert(members).values({ id: 2, name: "Miembro B" });
      await testDb.db.insert(accounts).values([
        { id: 2, name: "Cuenta de Miembro B", type: "personal", memberId: 2 },
      ]);
      await testDb.db.insert(tags).values([
        { id: 1, name: "Coche", slug: "coche", status: "active" },
      ]);
      const repository = new DrizzleMovementRepository(testDb.db);
      await repository.create(buildMovement({ date: "2026-09-05", note: "Hipoteca común" }));
      await repository.create(
        buildMovement({
          accountId: AccountId(1),
          date: "2026-09-10",
          note: "Gasolina",
          nature: "personal",
          tagId: TagId(1),
        }),
      );
      await repository.create(
        buildMovement({
          accountId: AccountId(2),
          date: "2026-09-12",
          note: "Compra semanal",
          amount: Money.fromCents(15_050),
          tagId: TagId(3),
        }),
      );

      const result = await repository.listByMonth("2026-09");

      expect(result.map((movement) => movement.note)).toEqual([
        "Compra semanal",
        "Gasolina",
        "Hipoteca común",
      ]);
      const gasolina = result.find((movement) => movement.note === "Gasolina");
      expect(gasolina?.tag).toEqual({ id: 1, name: "Coche", slug: "coche" });
      const hipoteca = result.find((movement) => movement.note === "Hipoteca común");
      expect(hipoteca?.tag).toEqual({ id: 2, name: "Vivienda", slug: "vivienda" });
    });

    it("respeta el rango exacto del mes sin meses contiguos ni otros años", async () => {
      const repository = new DrizzleMovementRepository(testDb.db);
      await repository.create(buildMovement({ date: "2026-09-01", note: "Primero" }));
      await repository.create(buildMovement({ date: "2026-09-30", note: "Último" }));
      await repository.create(buildMovement({ date: "2026-10-01", note: "Mes siguiente" }));
      await repository.create(buildMovement({ date: "2026-08-31", note: "Mes anterior" }));
      await repository.create(buildMovement({ date: "2025-09-15", note: "Otro año" }));

      const result = await repository.listByMonth("2026-09");

      expect(result.map((movement) => movement.note)).toEqual(["Último", "Primero"]);
    });

    it("cruza correctamente el cambio de año (diciembre → enero)", async () => {
      const repository = new DrizzleMovementRepository(testDb.db);
      await repository.create(buildMovement({ date: "2026-12-31", note: "Fin de año" }));
      await repository.create(buildMovement({ date: "2027-01-01", note: "Año nuevo" }));

      const december = await repository.listByMonth("2026-12");
      const january = await repository.listByMonth("2027-01");

      expect(december.map((movement) => movement.note)).toEqual(["Fin de año"]);
      expect(january.map((movement) => movement.note)).toEqual(["Año nuevo"]);
    });

    it("devuelve [] para un mes sin movimientos", async () => {
      const repository = new DrizzleMovementRepository(testDb.db);
      await repository.create(buildMovement({ date: "2026-09-15" }));

      expect(await repository.listByMonth("2026-06")).toEqual([]);
    });

    it("la unión de los listados por cuenta equivale al listado global del mes", async () => {
      await testDb.db.insert(members).values({ id: 2, name: "Miembro B" });
      await testDb.db.insert(accounts).values([
        { id: 2, name: "Cuenta de Miembro B", type: "personal", memberId: 2 },
      ]);
      const repository = new DrizzleMovementRepository(testDb.db);
      await repository.create(buildMovement({ date: "2026-09-05", note: "Común" }));
      await repository.create(
        buildMovement({ accountId: AccountId(1), date: "2026-09-10", note: "Miembro A" }),
      );
      await repository.create(
        buildMovement({ accountId: AccountId(2), date: "2026-09-12", note: "Miembro B" }),
      );

      const global = await repository.listByMonth("2026-09");
      const perAccount = (
        await Promise.all(
          [1, 2, 3].map((accountId) =>
            repository.listByMonthAndAccount(AccountId(accountId), "2026-09"),
          ),
        )
      ).flat();

      const byId = (list: typeof global) => [...list].sort((a, b) => a.id - b.id);
      expect(byId(global)).toEqual(byId(perAccount));
      expect(global).toHaveLength(3);
    });
  });

  describe("listByYear", () => {
    it("devuelve los movimientos de todas las cuentas del año con su tag", async () => {
      await testDb.db.insert(members).values({ id: 2, name: "Miembro B" });
      await testDb.db.insert(accounts).values([
        { id: 2, name: "Cuenta de Miembro B", type: "personal", memberId: 2 },
      ]);
      await testDb.db.insert(tags).values([
        { id: 1, name: "Coche", slug: "coche", status: "active" },
      ]);
      const repository = new DrizzleMovementRepository(testDb.db);
      await repository.create(
        buildMovement({ date: "2026-01-05", note: "Hipoteca enero", tagId: TagId(3) }),
      );
      await repository.create(
        buildMovement({
          accountId: AccountId(1),
          date: "2026-07-10",
          note: "Gasolina julio",
          nature: "personal",
          tagId: TagId(1),
        }),
      );
      await repository.create(
        buildMovement({
          accountId: AccountId(2),
          date: "2026-12-20",
          note: "Compra diciembre",
          amount: Money.fromCents(15_050),
        }),
      );

      const result = await repository.listByYear("2026");

      expect(result.map((movement) => movement.note)).toEqual([
        "Compra diciembre",
        "Gasolina julio",
        "Hipoteca enero",
      ]);
      const gasolina = result.find((movement) => movement.note === "Gasolina julio");
      expect(gasolina?.tag).toEqual({ id: 1, name: "Coche", slug: "coche" });
      const hipoteca = result.find((movement) => movement.note === "Hipoteca enero");
      expect(hipoteca?.tag).toEqual({ id: 3, name: "Hipoteca", slug: "hipoteca" });
    });

    it("respeta el rango exacto del año sin el 31-dic anterior ni el 1-ene siguiente", async () => {
      const repository = new DrizzleMovementRepository(testDb.db);
      await repository.create(buildMovement({ date: "2026-01-01", note: "Primero" }));
      await repository.create(buildMovement({ date: "2026-12-31", note: "Último" }));
      await repository.create(buildMovement({ date: "2027-01-01", note: "Año siguiente" }));
      await repository.create(buildMovement({ date: "2025-12-31", note: "Año anterior" }));

      const result = await repository.listByYear("2026");

      expect(result.map((movement) => movement.note)).toEqual(["Último", "Primero"]);
    });

    it("devuelve [] para un año sin movimientos", async () => {
      const repository = new DrizzleMovementRepository(testDb.db);
      await repository.create(buildMovement({ date: "2026-09-15" }));

      expect(await repository.listByYear("2027")).toEqual([]);
    });

    it("la unión de las 12 llamadas mensuales equivale al listado por año", async () => {
      const repository = new DrizzleMovementRepository(testDb.db);
      await repository.create(buildMovement({ date: "2026-01-15", note: "Enero" }));
      await repository.create(buildMovement({ date: "2026-06-15", note: "Junio" }));
      await repository.create(buildMovement({ date: "2026-12-15", note: "Diciembre" }));
      await repository.create(buildMovement({ date: "2027-02-15", note: "Año siguiente" }));

      const year = await repository.listByYear("2026");
      const months = await Promise.all(
        Array.from({ length: 12 }, (_, month) =>
          repository.listByMonth(`2026-${String(month + 1).padStart(2, "0")}`),
        ),
      );

      const byId = (list: typeof year) => [...list].sort((a, b) => a.id - b.id);
      expect(byId(year)).toEqual(byId(months.flat()));
      expect(year).toHaveLength(3);
    });
  });

  describe("findById", () => {
    it("rehidrata el movimiento con su tag única", async () => {
      const repository = new DrizzleMovementRepository(testDb.db);
      const movementId = await repository.create(buildMovement());

      const found = await repository.findById(movementId);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(movementId);
      expect(found?.note).toBe("Hipoteca");
      expect(found?.nature).toBe("shared");
      expect(found?.tagId).toBe(TagId(2));
      expect(found?.createdAt).toBeTypeOf("string");
    });

    it("devuelve null si no existe el movimiento", async () => {
      const repository = new DrizzleMovementRepository(testDb.db);

      expect(await repository.findById(MovementId(999))).toBeNull();
    });
  });

  describe("update", () => {
    it("actualiza la fila con su tag única, cambia fecha y pone updated_at", async () => {
      const repository = new DrizzleMovementRepository(testDb.db);
      const movementId = await repository.create(buildMovement());
      const [originalRow] = await testDb.db.select().from(movements);

      const recreated = Movement.recreate(
        movementId,
        {
          accountId: AccountId(3),
          type: "expense",
          date: "2026-08-05",
          note: "Hipoteca editada",
          amount: Money.fromCents(150_000),
          nature: "shared",
          tagId: TagId(3),
        },
        originalRow.createdAt,
      );

      await repository.update(recreated);

      const [updatedRow] = await testDb.db.select().from(movements);
      expect(updatedRow.id).toBe(originalRow.id);
      expect(updatedRow.createdAt).toBe(originalRow.createdAt);
      expect(updatedRow.accountId).toBe(3);
      expect(updatedRow.type).toBe("expense");
      expect(updatedRow.date).toBe("2026-08-05");
      expect(updatedRow.note).toBe("Hipoteca editada");
      expect(updatedRow.amountCents).toBe(150_000);
      expect(updatedRow.tagId).toBe(3);
      expect(updatedRow.updatedAt).not.toBeNull();
    });

    it("updated_at es null mientras el movimiento no se edita", async () => {
      const repository = new DrizzleMovementRepository(testDb.db);
      await repository.create(buildMovement());

      const [row] = await testDb.db.select().from(movements);
      expect(row.updatedAt).toBeNull();
    });
  });

  describe("delete", () => {
    it("borra la fila sin tocar el catálogo tags", async () => {
      const repository = new DrizzleMovementRepository(testDb.db);
      const movementId = await repository.create(buildMovement());

      await repository.delete(movementId);

      const remainingMovements = await testDb.db.select().from(movements);
      expect(remainingMovements).toHaveLength(0);

      const catalogTags = await testDb.db.select().from(tags);
      expect(catalogTags.map((tag) => tag.id)).toEqual([2, 3]);
    });
  });

  describe("migración 0002 y FK RESTRICT (SC-003)", () => {
    it("la BD de test nace sin tabla movement_tags y con la columna note en movements", async () => {
      const tables = await testDb.client.execute(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
      );
      const tableNames = tables.rows.map((row) => row.name);
      expect(tableNames).toContain("movements");
      expect(tableNames).not.toContain("movement_tags");

      const columns = await testDb.client.execute("PRAGMA table_info(movements)");
      const columnNames = columns.rows.map((row) => row.name);
      expect(columnNames).toContain("note");
      expect(columnNames).toContain("tag_id");
      expect(columnNames).not.toContain("concept");
      expect(columnNames).not.toContain("description");
    });

    it("borrar una tag con movimientos falla por FK RESTRICT", async () => {
      const repository = new DrizzleMovementRepository(testDb.db);
      await repository.create(buildMovement());

      await expect(testDb.client.execute("DELETE FROM tags WHERE id = 2")).rejects.toThrow();
    });

    it("borrar una tag sin movimientos sí está permitido", async () => {
      await expect(
        testDb.client.execute("DELETE FROM tags WHERE id = 3"),
      ).resolves.toBeDefined();
    });
  });
});
