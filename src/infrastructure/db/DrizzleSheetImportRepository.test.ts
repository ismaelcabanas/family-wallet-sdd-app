import { InvalidMovementError } from "@/domain/movement/MovementErrors";
import { beforeEach, describe, expect, it } from "vitest";

import { DrizzleSheetImportRepository } from "./DrizzleSheetImportRepository";
import { accounts } from "./schema/accounts";
import { movements } from "./schema/movements";
import { tags } from "./schema/tags";
import { tagCategories } from "./schema/tag-categories";
import { createTestDb, type TestDb } from "./test-support";
import type { ExecutableImportPlan } from "@/application/import/SheetImportRepository";
import type { PlannedMovement } from "@/application/import/sheet-import-plan";

let testDb: TestDb;

beforeEach(async () => {
  testDb = await createTestDb();
  await testDb.db.insert(accounts).values({ name: "Cuenta común", type: "shared" });
});

function movement(overrides: Partial<PlannedMovement> = {}): PlannedMovement {
  return {
    date: "2026-01-01",
    note: "Carrera",
    amountCents: 785,
    type: "expense",
    nature: "personal",
    tagName: "Ocio",
    tagId: 1,
    createsTag: false,
    ...overrides,
  };
}

function plan(overrides: Partial<ExecutableImportPlan> = {}): ExecutableImportPlan {
  return {
    accountId: 1,
    movements: [movement()],
    tagsToCreate: [],
    ...overrides,
  };
}

describe("DrizzleSheetImportRepository", () => {
  it("persiste etiquetas nuevas activas en la genérica y movimientos con tagId resuelto, y devuelve contadores", async () => {
    await testDb.db
      .insert(tags)
      .values({ id: 1, name: "Ocio", slug: "ocio", status: "active", categoryId: 1 });
    const repository = new DrizzleSheetImportRepository(testDb.db);

    const result = await repository.persist(
      plan({
        movements: [
          movement(),
          movement({ note: "Pienso", amountCents: 1865, tagName: "Mascotas", tagId: null, createsTag: true }),
        ],
        tagsToCreate: [{ name: "Mascotas", categoryId: 1 }],
      }),
    );

    expect(result).toEqual({ movementsCreated: 2, tagsCreated: 1 });

    const storedTags = await testDb.db.select().from(tags);
    const mascotas = storedTags.find((tag) => tag.name === "Mascotas");
    expect(mascotas).toMatchObject({
      slug: "mascotas",
      status: "active",
      categoryId: 1,
    });

    const storedMovements = await testDb.db.select().from(movements);
    expect(storedMovements).toHaveLength(2);
    expect(storedMovements[0]).toMatchObject({
      accountId: 1,
      type: "expense",
      date: "2026-01-01",
      note: "Carrera",
      amountCents: 785,
      nature: "personal",
      tagId: 1,
    });
    expect(storedMovements[1]).toMatchObject({ note: "Pienso", tagId: mascotas?.id });
  });

  it("la categoría genérica sembrada por la migración 0008 existe (categoryId 1)", async () => {
    const categories = await testDb.db.select().from(tagCategories);

    expect(categories).toHaveLength(1);
    expect(categories[0]).toMatchObject({ name: "General", slug: "general" });
  });

  it("dedupe: dos movimientos que crean la misma etiqueta solo crean una, con el mismo tagId", async () => {
    const repository = new DrizzleSheetImportRepository(testDb.db);

    const result = await repository.persist(
      plan({
        movements: [
          movement({ note: "Pienso", tagName: "Mascotas", tagId: null, createsTag: true }),
          movement({ note: "Arena", amountCents: 900, tagName: "Mascotas", tagId: null, createsTag: true }),
        ],
        tagsToCreate: [{ name: "Mascotas", categoryId: 1 }],
      }),
    );

    expect(result).toEqual({ movementsCreated: 2, tagsCreated: 1 });
    const storedTags = await testDb.db.select().from(tags);
    expect(storedTags.filter((tag) => tag.name === "Mascotas")).toHaveLength(1);
    const mascotas = storedTags.find((tag) => tag.name === "Mascotas");
    const storedMovements = await testDb.db.select().from(movements);
    expect(storedMovements.map((row) => row.tagId)).toEqual([mascotas?.id, mascotas?.id]);
  });

  it("slug único con sufijo -2 al colisionar (paridad CreateTag)", async () => {
    await testDb.db.insert(tags).values({
      name: "Mascotas (vieja)",
      slug: "mascotas",
      status: "active",
      categoryId: 1,
    });
    const repository = new DrizzleSheetImportRepository(testDb.db);

    await repository.persist(
      plan({
        movements: [movement({ note: "Pienso", tagName: "Mascotas", tagId: null, createsTag: true })],
        tagsToCreate: [{ name: "Mascotas", categoryId: 1 }],
      }),
    );

    const storedTags = await testDb.db.select().from(tags);
    const mascotasSlugs = storedTags
      .filter((tag) => tag.slug.startsWith("mascotas"))
      .map((tag) => tag.slug)
      .sort();
    expect(mascotasSlugs).toEqual(["mascotas", "mascotas-2"]);
  });

  it("fallo intermedio ⇒ rollback total: ni etiquetas ni movimientos (FR-005/SC-003)", async () => {
    await testDb.db
      .insert(tags)
      .values({ id: 1, name: "Ocio", slug: "ocio", status: "active", categoryId: 1 });
    const repository = new DrizzleSheetImportRepository(testDb.db);

    await expect(
      repository.persist(
        plan({
          movements: [
            movement({ note: "Pienso", tagName: "Mascotas", tagId: null, createsTag: true }),
            movement({ note: "   ", tagName: "Ocio" }),
          ],
          tagsToCreate: [{ name: "Mascotas", categoryId: 1 }],
        }),
      ),
    ).rejects.toThrowError(InvalidMovementError);

    const storedTags = await testDb.db.select().from(tags);
    expect(storedTags.filter((tag) => tag.name === "Mascotas")).toHaveLength(0);
    expect(await testDb.db.select().from(movements)).toHaveLength(0);
  });
});
