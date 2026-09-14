import { AccountId } from "@/domain/account/AccountId";
import { TagId } from "@/domain/tag/TagId";
import { Movement } from "@/domain/movement/Movement";
import { MovementId } from "@/domain/movement/MovementId";
import { Money } from "@/domain/movement/Money";
import { beforeEach, describe, expect, it } from "vitest";

import { DrizzleMovementRepository } from "./DrizzleMovementRepository";
import { accounts } from "./schema/accounts";
import { members } from "./schema/members";
import { movementTags } from "./schema/movement-tags";
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
    concept: "Hipoteca",
    description: null,
    amount: Money.fromCents(85_000),
    nature: "shared",
    tagIds: [TagId(2), TagId(3)],
    ...overrides,
  });
}

describe("DrizzleMovementRepository", () => {
  it("crea el movimiento con sus tags de forma atómica", async () => {
    const repository = new DrizzleMovementRepository(testDb.db);
    const movement = buildMovement();

    const movementId = await repository.create(movement);

    expect(movementId).toBe(1);
    const [storedMovement] = await testDb.db.select().from(movements);
    expect(storedMovement.concept).toBe("Hipoteca");
    expect(storedMovement.amountCents).toBe(85_000);
    expect(storedMovement.nature).toBe("shared");

    const storedTags = await testDb.db.select().from(movementTags);
    expect(storedTags).toEqual([
      { movementId: 1, tagId: 2 },
      { movementId: 1, tagId: 3 },
    ]);
  });

  it("lista por mes y cuenta con rango semicerrado [mes-01, mesSiguiente-01)", async () => {
    const repository = new DrizzleMovementRepository(testDb.db);
    await repository.create(buildMovement({ date: "2026-09-01" }));
    await repository.create(buildMovement({ date: "2026-09-30", concept: "Fin de mes" }));
    await repository.create(buildMovement({ date: "2026-10-01", concept: "Mes siguiente" }));
    await repository.create(buildMovement({ date: "2026-08-31", concept: "Mes anterior" }));
    await repository.create(
      buildMovement({ accountId: AccountId(1), date: "2026-09-15", concept: "Otra cuenta" }),
    );

    const result = await repository.listByMonthAndAccount(AccountId(3), "2026-09");

    expect(result.map((movement) => movement.concept)).toEqual(["Fin de mes", "Hipoteca"]);
  });

  it("incluye las tags de cada movimiento en el listado", async () => {
    const repository = new DrizzleMovementRepository(testDb.db);
    await repository.create(buildMovement());

    const [movement] = await repository.listByMonthAndAccount(AccountId(3), "2026-09");

    expect(movement.tags).toEqual([
      { id: 2, name: "Vivienda", slug: "vivienda" },
      { id: 3, name: "Hipoteca", slug: "hipoteca" },
    ]);
  });

  it("cubre febrero y años bisiestos por construcción", async () => {
    const repository = new DrizzleMovementRepository(testDb.db);
    await repository.create(buildMovement({ date: "2024-02-29", concept: "Bisiesto" }));
    await repository.create(buildMovement({ date: "2024-03-01", concept: "Marzo" }));

    const february = await repository.listByMonthAndAccount(AccountId(3), "2024-02");

    expect(february.map((movement) => movement.concept)).toEqual(["Bisiesto"]);
  });

  it("ordena por fecha descendente dentro del mes", async () => {
    const repository = new DrizzleMovementRepository(testDb.db);
    await repository.create(buildMovement({ date: "2026-09-02", concept: "Antiguo" }));
    await repository.create(buildMovement({ date: "2026-09-28", concept: "Reciente" }));

    const result = await repository.listByMonthAndAccount(AccountId(3), "2026-09");

    expect(result.map((movement) => movement.concept)).toEqual(["Reciente", "Antiguo"]);
  });

  it("filtra solo por la fecha del movimiento, no por la de creación (FR-004)", async () => {
    const repository = new DrizzleMovementRepository(testDb.db);
    await repository.create(
      buildMovement({ date: "2026-08-10", concept: "Movimiento de otro mes" }),
    );

    const currentMonth = await repository.listByMonthAndAccount(AccountId(3), "2026-09");
    const previousMonth = await repository.listByMonthAndAccount(AccountId(3), "2026-08");

    expect(currentMonth).toHaveLength(0);
    expect(previousMonth.map((movement) => movement.concept)).toEqual(["Movimiento de otro mes"]);
  });

  describe("findById", () => {
    it("rehidrata el movimiento con sus tags", async () => {
      const repository = new DrizzleMovementRepository(testDb.db);
      const movementId = await repository.create(buildMovement());

      const found = await repository.findById(movementId);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(movementId);
      expect(found?.concept).toBe("Hipoteca");
      expect(found?.nature).toBe("shared");
      expect([...(found?.tagIds ?? [])]).toEqual([TagId(2), TagId(3)]);
      expect(found?.createdAt).toBeTypeOf("string");
    });

    it("devuelve null si no existe el movimiento", async () => {
      const repository = new DrizzleMovementRepository(testDb.db);

      expect(await repository.findById(MovementId(999))).toBeNull();
    });
  });

  describe("update", () => {
    it("sustituye la fila y el conjunto de tags, cambia cuenta y fecha y pone updated_at", async () => {
      const repository = new DrizzleMovementRepository(testDb.db);
      const movementId = await repository.create(buildMovement());
      const [originalRow] = await testDb.db.select().from(movements);

      const recreated = Movement.recreate(
        movementId,
        {
          accountId: AccountId(1),
          type: "income",
          date: "2026-08-05",
          concept: "Nómina",
          description: null,
          amount: Money.fromCents(150_000),
          nature: null,
          tagIds: [TagId(2)],
        },
        originalRow.createdAt,
      );

      await repository.update(recreated);

      const [updatedRow] = await testDb.db.select().from(movements);
      expect(updatedRow.id).toBe(originalRow.id);
      expect(updatedRow.createdAt).toBe(originalRow.createdAt);
      expect(updatedRow.accountId).toBe(1);
      expect(updatedRow.type).toBe("income");
      expect(updatedRow.date).toBe("2026-08-05");
      expect(updatedRow.concept).toBe("Nómina");
      expect(updatedRow.amountCents).toBe(150_000);
      expect(updatedRow.updatedAt).not.toBeNull();

      const storedTags = await testDb.db.select().from(movementTags);
      expect(storedTags).toEqual([{ movementId, tagId: 2 }]);
    });

    it("updated_at es null mientras el movimiento no se edita", async () => {
      const repository = new DrizzleMovementRepository(testDb.db);
      await repository.create(buildMovement());

      const [row] = await testDb.db.select().from(movements);
      expect(row.updatedAt).toBeNull();
    });
  });

  describe("delete", () => {
    it("borra la fila y sus movement_tags sin tocar el catálogo tags", async () => {
      const repository = new DrizzleMovementRepository(testDb.db);
      const movementId = await repository.create(buildMovement());

      await repository.delete(movementId);

      const remainingMovements = await testDb.db.select().from(movements);
      expect(remainingMovements).toHaveLength(0);

      const remainingMovementTags = await testDb.db.select().from(movementTags);
      expect(remainingMovementTags).toHaveLength(0);

      const catalogTags = await testDb.db.select().from(tags);
      expect(catalogTags.map((tag) => tag.id)).toEqual([2, 3]);
    });
  });
});
