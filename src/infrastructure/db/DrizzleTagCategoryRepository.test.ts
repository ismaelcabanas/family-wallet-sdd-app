import { TagCategory } from "@/domain/tag-category/TagCategory";
import { TagCategoryId } from "@/domain/tag-category/TagCategoryId";
import {
  CategoryNotEmptyError,
  DuplicateCategoryNameError,
} from "@/domain/tag-category/TagCategoryErrors";
import { beforeEach, describe, expect, it } from "vitest";

import { DrizzleTagCategoryRepository } from "./DrizzleTagCategoryRepository";
import { tags } from "./schema/tags";
import { createTestDb, type TestDb } from "./test-support";

let testDb: TestDb;

beforeEach(async () => {
  testDb = await createTestDb();
});

describe("DrizzleTagCategoryRepository", () => {
  it("la migración 0008 siembra la genérica «General» con slug «general»", async () => {
    const repository = new DrizzleTagCategoryRepository(testDb.db);

    const general = await repository.findBySlug("general");

    expect(general?.id).toBe(1);
    expect(general?.name).toBe("General");
  });

  it("save persiste la categoría y findAll la devuelve", async () => {
    const repository = new DrizzleTagCategoryRepository(testDb.db);

    const saved = await repository.save(TagCategory.create({ name: "Alimentación", slug: "alimentacion" }));

    expect(saved.id).not.toBeNull();
    const all = await repository.findAll();
    expect(all.map((category) => category.slug)).toEqual(["alimentacion", "general"]);
  });

  it("findById resuelve la entidad y devuelve null si no existe", async () => {
    const repository = new DrizzleTagCategoryRepository(testDb.db);

    const found = await repository.findById(TagCategoryId(1));
    const missing = await repository.findById(TagCategoryId(999));

    expect(found?.name).toBe("General");
    expect(missing).toBeNull();
  });

  it("findBySlug resuelve por slug exacto", async () => {
    const repository = new DrizzleTagCategoryRepository(testDb.db);

    expect(await repository.findBySlug("no-existe")).toBeNull();
    expect((await repository.findBySlug("general"))?.id).toBe(1);
  });

  it("findByName es case-insensitive (índice lower(name))", async () => {
    const repository = new DrizzleTagCategoryRepository(testDb.db);

    const found = await repository.findByName("GENERAL");
    const missing = await repository.findByName("No existe");

    expect(found?.id).toBe(1);
    expect(missing).toBeNull();
  });

  it("update persiste el renombrado conservando el slug", async () => {
    const repository = new DrizzleTagCategoryRepository(testDb.db);

    const updated = await repository.update(
      (await repository.findById(TagCategoryId(1)))!.rename("Varias"),
    );

    expect(updated.name).toBe("Varias");
    expect(updated.slug).toBe("general");
    expect((await repository.findById(TagCategoryId(1)))?.name).toBe("Varias");
  });

  it("save traduce la violación del índice nocase a DuplicateCategoryNameError (carrera)", async () => {
    const repository = new DrizzleTagCategoryRepository(testDb.db);

    await expect(
      repository.save(TagCategory.create({ name: "GENERAL", slug: "general-2" })),
    ).rejects.toThrowError(new DuplicateCategoryNameError("GENERAL"));
  });

  it("countTags cuenta las etiquetas asignadas a la categoría", async () => {
    const repository = new DrizzleTagCategoryRepository(testDb.db);
    await testDb.db.insert(tags).values([
      { id: 1, name: "Luz", slug: "luz", status: "active", categoryId: 1 },
      { id: 2, name: "Ocio", slug: "ocio", status: "inactive", categoryId: 1 },
    ]);

    expect(await repository.countTags(TagCategoryId(1))).toBe(3);
    expect(await repository.countTags(TagCategoryId(999))).toBe(0);
  });

  it("delete elimina una categoría vacía", async () => {
    const repository = new DrizzleTagCategoryRepository(testDb.db);
    const saved = await repository.save(TagCategory.create({ name: "Viajes", slug: "viajes" }));

    await repository.delete(saved.id as TagCategoryId);

    expect(await repository.findById(saved.id as TagCategoryId)).toBeNull();
  });

  it("DELETE de categoría con etiquetas abortado por FK RESTRICT → CategoryNotEmptyError", async () => {
    const repository = new DrizzleTagCategoryRepository(testDb.db);
    await testDb.db.insert(tags).values([
      { id: 1, name: "Luz", slug: "luz", status: "active", categoryId: 1 },
    ]);

    await expect(repository.delete(TagCategoryId(1))).rejects.toThrowError(
      new CategoryNotEmptyError("General"),
    );
    expect((await repository.findById(TagCategoryId(1)))?.name).toBe("General");
  });
});
