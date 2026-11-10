import { AccountId } from "@/domain/account/AccountId";
import { DuplicateAccountNameError } from "@/domain/account/AccountErrors";
import { Movement } from "@/domain/movement/Movement";
import { MovementId } from "@/domain/movement/MovementId";
import { Money } from "@/domain/movement/Money";
import { DuplicateMemberNameError } from "@/domain/member/MemberErrors";
import { MemberId } from "@/domain/member/MemberId";
import { Tag } from "@/domain/tag/Tag";
import { DuplicateTagNameError } from "@/domain/tag/TagErrors";
import { TagId } from "@/domain/tag/TagId";
import { TagCategoryId } from "@/domain/tag-category/TagCategoryId";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { DrizzleAccountRepository } from "./DrizzleAccountRepository";
import { DrizzleMemberRepository } from "./DrizzleMemberRepository";
import { DrizzleMovementRepository } from "./DrizzleMovementRepository";
import { DrizzleTagRepository } from "./DrizzleTagRepository";
import { accounts } from "./schema/accounts";
import { members } from "./schema/members";
import { movements } from "./schema/movements";
import { tagCategories } from "./schema/tag-categories";
import { tags } from "./schema/tags";
import { createTestDb, type TestDb } from "./test-support";

let testDb: TestDb;

beforeEach(async () => {
  testDb = await createTestDb();
  await testDb.db.insert(members).values([
    { id: 1, name: "Miembro A" },
    { id: 2, name: "Miembro B" },
  ]);
  await testDb.db.insert(accounts).values([
    { id: 1, name: null, type: "personal", memberId: 1 },
    { id: 3, name: "Cuenta común", type: "shared", memberId: null },
  ]);
  await testDb.db.insert(tags).values([
    { id: 1, name: "Luz", slug: "luz", status: "active", categoryId: 1 },
    { id: 2, name: "Inactiva", slug: "inactiva", status: "inactive", categoryId: 1 },
    { id: 9, name: "Sin Clasificar", slug: "sin-clasificar", status: "active", categoryId: 1 },
  ]);
});

function buildMovement(overrides: Partial<Parameters<typeof Movement.create>[0]> = {}) {
  return Movement.create({
    accountId: AccountId(1),
    type: "expense",
    date: "2026-09-15",
    note: "Gasto",
    amount: Money.fromCents(1_000),
    nature: "personal",
    tagId: TagId(9),
    ...overrides,
  });
}

describe("DrizzleAccountRepository", () => {
  it("findAll devuelve el DTO con el nombre derivado en personales y el almacenado en la común", async () => {
    const repository = new DrizzleAccountRepository(testDb.db);

    const result = await repository.findAll();

    expect(result).toEqual([
      {
        id: 1,
        name: "Cuenta de Miembro A",
        type: "personal",
        memberId: 1,
        memberName: "Miembro A",
      },
      { id: 3, name: "Cuenta común", type: "shared", memberId: null, memberName: null },
    ]);
    expect(result.every((dto) => typeof dto.name === "string")).toBe(true);
  });

  it("findById devuelve la entidad (name null en personales) o null", async () => {
    const repository = new DrizzleAccountRepository(testDb.db);

    const found = await repository.findById(AccountId(1));
    const missing = await repository.findById(AccountId(999));

    expect(found?.name).toBeNull();
    expect(found?.memberId).toBe(1);
    expect(missing).toBeNull();
  });

  it("findByName es nocase sobre nombres almacenados; las personales (NULL) nunca matchean", async () => {
    const repository = new DrizzleAccountRepository(testDb.db);

    const nocase = await repository.findByName("cuenta común");
    const personal = await repository.findByName("Cuenta de Miembro A");
    const missing = await repository.findByName("No existe");

    expect(nocase?.id).toBe(3);
    expect(personal).toBeNull();
    expect(missing).toBeNull();
  });

  it("update persiste el renombrado de la común y devuelve la entidad rehidratada", async () => {
    const repository = new DrizzleAccountRepository(testDb.db);
    const account = await repository.findById(AccountId(3));

    const updated = await repository.update(account!.rename("  Cuenta conjunta  "));

    expect(updated.name).toBe("Cuenta conjunta");
    expect(updated.id).toBe(3);
    const reloaded = await repository.findById(AccountId(3));
    expect(reloaded?.name).toBe("Cuenta conjunta");
  });

  it("update traduce la carrera del índice nocase a DuplicateAccountNameError", async () => {
    const repository = new DrizzleAccountRepository(testDb.db);
    await testDb.db
      .insert(accounts)
      .values({ id: 4, name: "Cuenta conjunta", type: "shared", memberId: null });
    const account = await repository.findById(AccountId(3));

    await expect(repository.update(account!.rename("CUENTA CONJUNTA"))).rejects.toThrowError(
      new DuplicateAccountNameError("CUENTA CONJUNTA"),
    );
  });
});

describe("DrizzleTagRepository", () => {
  it("findAllActive devuelve solo las tags activas", async () => {
    const repository = new DrizzleTagRepository(testDb.db);

    const active = await repository.findAllActive();

    expect(active.map((tag) => tag.slug)).toEqual(["aportacion-comun", "luz", "sin-clasificar"]);
  });

  it("findBySlug resuelve la tag por defecto (FR-006)", async () => {
    const repository = new DrizzleTagRepository(testDb.db);

    const tag = await repository.findBySlug("sin-clasificar");

    expect(tag?.name).toBe("Sin Clasificar");
    expect(await repository.findBySlug("no-existe")).toBeNull();
  });

  it("findByIds devuelve las tags solicitadas", async () => {
    const repository = new DrizzleTagRepository(testDb.db);

    const found = await repository.findByIds([TagId(1), TagId(2)]);

    expect(found).toHaveLength(2);
  });

  it("rechaza nombres duplicados ignorando mayúsculas (FR-007, índice lower(name))", async () => {
    await expect(
      testDb.db.insert(tags).values({ name: "LUZ", slug: "luz-duplicada", status: "active", categoryId: 1 }),
    ).rejects.toThrowError();
  });

  it("findByName es case-insensitive (espejo del índice lower(name))", async () => {
    const repository = new DrizzleTagRepository(testDb.db);

    const found = await repository.findByName("LUZ");
    const exact = await repository.findByName("Luz");
    const missing = await repository.findByName("No existe");

    expect(found?.slug).toBe("luz");
    expect(exact?.slug).toBe("luz");
    expect(missing).toBeNull();
  });

  it("findByName no colisiona por acentos (lower ASCII de SQLite)", async () => {
    const repository = new DrizzleTagRepository(testDb.db);

    await testDb.db.insert(tags).values({
      id: 4,
      name: "Alimentación",
      slug: "alimentacion",
      status: "active",
      categoryId: 1,
    });

    expect(await repository.findByName("Alimentacion")).toBeNull();
    expect((await repository.findByName("Alimentación"))?.slug).toBe("alimentacion");
  });

  it("findByName ignora el estado (encuentra también inactivas)", async () => {
    const repository = new DrizzleTagRepository(testDb.db);

    const found = await repository.findByName("inactiva");

    expect(found?.slug).toBe("inactiva");
    expect(found?.status).toBe("inactive");
  });

  it("backfill de 0008: la etiqueta sembrada por la migración 0004 queda en la genérica (SC-001)", async () => {
    const repository = new DrizzleTagRepository(testDb.db);

    const contributionTag = await repository.findBySlug("aportacion-comun");

    expect(contributionTag?.id).toBe(100);
    expect(contributionTag?.name).toBe("Aportación Común");
    expect(contributionTag?.status).toBe("active");
    expect(contributionTag?.categoryId).toBe(1);
  });

  it("findAll rehidrata el categoryId de cada etiqueta", async () => {
    const repository = new DrizzleTagRepository(testDb.db);

    const all = await repository.findAll();

    expect(all.every((tag) => tag.categoryId === 1)).toBe(true);
  });

  it("save persiste la etiqueta y la devuelve con id asignado y su categoría", async () => {
    const repository = new DrizzleTagRepository(testDb.db);
    const tag = Tag.create({
      name: "Mascotas",
      slug: "mascotas",
      status: "active",
      categoryId: TagCategoryId(1),
    });

    const saved = await repository.save(tag);
    const reloaded = await repository.findBySlug("mascotas");

    expect(saved.id).not.toBeNull();
    expect(saved.name).toBe("Mascotas");
    expect(saved.status).toBe("active");
    expect(saved.categoryId).toBe(1);
    expect(reloaded?.id).toBe(saved.id);
    expect(reloaded?.categoryId).toBe(1);
  });

  it("save traduce la violación del constraint de nombre a DuplicateTagNameError (carrera)", async () => {
    const repository = new DrizzleTagRepository(testDb.db);
    const tag = Tag.create({
      name: "LUZ",
      slug: "luz-2",
      status: "active",
      categoryId: TagCategoryId(1),
    });

    await expect(repository.save(tag)).rejects.toThrowError(new DuplicateTagNameError("LUZ"));
  });

  it("findAll devuelve activas e inactivas ordenadas por nombre", async () => {
    const repository = new DrizzleTagRepository(testDb.db);

    const all = await repository.findAll();

    expect(all.map((tag) => tag.slug)).toEqual([
      "aportacion-comun",
      "inactiva",
      "luz",
      "sin-clasificar",
    ]);
  });

  it("findById resuelve la entidad y devuelve null si no existe", async () => {
    const repository = new DrizzleTagRepository(testDb.db);

    const found = await repository.findById(TagId(1));
    const missing = await repository.findById(TagId(999));

    expect(found?.name).toBe("Luz");
    expect(missing).toBeNull();
  });

  it("update persiste el renombrado rehidratando su categoría", async () => {
    const repository = new DrizzleTagRepository(testDb.db);
    const tag = await repository.findById(TagId(1));

    const updated = await repository.update(
      (tag as Tag).rename("Hogar"),
    );

    expect(updated.name).toBe("Hogar");
    expect(updated.slug).toBe("luz");
    expect(updated.categoryId).toBe(1);
    const reloaded = await repository.findById(TagId(1));
    expect(reloaded?.name).toBe("Hogar");
    expect(reloaded?.slug).toBe("luz");
    expect(reloaded?.categoryId).toBe(1);
  });

  it("update persiste el cambio de categoría (movimiento entre categorías)", async () => {
    const repository = new DrizzleTagRepository(testDb.db);
    await testDb.db
      .insert(tagCategories)
      .values({ id: 2, name: "Alimentación", slug: "alimentacion" });
    const tag = await repository.findById(TagId(1));

    const updated = await repository.update((tag as Tag).moveToCategory(TagCategoryId(2)));

    expect(updated.categoryId).toBe(2);
    expect((await repository.findById(TagId(1)))?.categoryId).toBe(2);
  });

  it("update persiste el cambio de estado", async () => {
    const repository = new DrizzleTagRepository(testDb.db);
    const tag = await repository.findById(TagId(1));

    const updated = await repository.update((tag as Tag).withStatus("inactive"));

    expect(updated.status).toBe("inactive");
    expect((await repository.findById(TagId(1)))?.status).toBe("inactive");
  });

  it("update hacia lower(name) ajeno lanza DuplicateTagNameError (carrera del índice)", async () => {
    const repository = new DrizzleTagRepository(testDb.db);
    const tag = await repository.findById(TagId(1));

    await expect(repository.update((tag as Tag).rename("Sin Clasificar"))).rejects.toThrowError(
      new DuplicateTagNameError("Sin Clasificar"),
    );
  });

  it("mergeInto reasigna los movimientos a la resultante, borra la absorbida y no toca updated_at (FR-006)", async () => {
    const repository = new DrizzleTagRepository(testDb.db);
    const movementRepository = new DrizzleMovementRepository(testDb.db);
    for (const note of ["Uno", "Dos"]) {
      const movement = buildMovement({ note, tagId: TagId(1) });
      await testDb.db.insert(movements).values({
        accountId: movement.accountId as number,
        type: movement.type,
        date: movement.date,
        note: movement.note,
        tagId: movement.tagId as number,
        amountCents: movement.amount.amountCents,
        nature: movement.nature,
        createdAt: movement.createdAt,
      });
    }

    const result = await repository.mergeInto(TagId(1), TagId(9));

    expect(result.reassignedMovements).toBe(2);
    expect(await repository.findById(TagId(1))).toBeNull();
    const rows = await testDb.db.select().from(movements);
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.tagId === 9)).toBe(true);
    expect(rows.every((row) => row.updatedAt === null)).toBe(true);

    const listed = await movementRepository.listByMonthAndAccount(AccountId(1), "2026-09");
    expect(listed).toHaveLength(2);
    expect(listed.every((dto) => dto.tag?.name === "Sin Clasificar")).toBe(true);
  });

  it("mergeInto conserva la categoría de la superviviente y no deja etiquetas huérfanas (edge 026)", async () => {
    const repository = new DrizzleTagRepository(testDb.db);
    await testDb.db
      .insert(tagCategories)
      .values({ id: 2, name: "Alimentación", slug: "alimentacion" });
    await testDb.db
      .insert(tags)
      .values({ id: 5, name: "Supermercado", slug: "supermercado", status: "active", categoryId: 2 });

    await repository.mergeInto(TagId(5), TagId(9));

    expect(await repository.findById(TagId(5))).toBeNull();
    const survivor = await repository.findById(TagId(9));
    expect(survivor?.categoryId).toBe(1);
    const orphanRows = await testDb.db
      .select()
      .from(tags)
      .where(eq(tags.categoryId, 2));
    expect(orphanRows).toHaveLength(0);
  });

  it("mergeInto con absorbida sin movimientos devuelve 0 y borra", async () => {
    const repository = new DrizzleTagRepository(testDb.db);

    const result = await repository.mergeInto(TagId(1), TagId(9));

    expect(result.reassignedMovements).toBe(0);
    expect(await repository.findById(TagId(1))).toBeNull();
    expect((await repository.findAll()).map((tag) => tag.slug)).not.toContain("luz");
  });
});

describe("DrizzleMovementRepository", () => {
  async function insertMovement(overrides: Partial<typeof movements.$inferInsert> = {}) {
    await testDb.db.insert(movements).values({
      accountId: 1,
      type: "expense",
      date: "2026-09-15",
      note: "Gasto",
      amountCents: 1_000,
      nature: "personal",
      tagId: 1,
      createdAt: "2026-09-01T10:00:00.000Z",
      updatedAt: null,
      ...overrides,
    });
  }

  it("retagMovements cambia tag_id solo de los ids dados en la cuenta y mes indicados", async () => {
    const repository = new DrizzleMovementRepository(testDb.db);
    await insertMovement({ id: 1 });
    await insertMovement({ id: 2 });
    await insertMovement({ id: 3, date: "2026-08-15" });
    await insertMovement({ id: 4, accountId: 3 });

    const result = await repository.retagMovements(
      AccountId(1),
      "2026-09",
      [MovementId(1), MovementId(2)],
      TagId(9),
    );

    expect(result).toEqual({ updated: 2 });
    const rows = await testDb.db.select().from(movements).orderBy(movements.id);
    expect(rows.find((row) => row.id === 1)?.tagId).toBe(9);
    expect(rows.find((row) => row.id === 2)?.tagId).toBe(9);
    expect(rows.find((row) => row.id === 3)?.tagId).toBe(1);
    expect(rows.find((row) => row.id === 4)?.tagId).toBe(1);
  });

  it("retagMovements actualiza updated_at de los reasignados y no el de los no tocados", async () => {
    const repository = new DrizzleMovementRepository(testDb.db);
    await insertMovement({ id: 1 });
    await insertMovement({ id: 2 });
    await insertMovement({ id: 3, date: "2026-08-15" });

    await repository.retagMovements(AccountId(1), "2026-09", [MovementId(1), MovementId(2), MovementId(3)], TagId(9));

    const rows = await testDb.db.select().from(movements).orderBy(movements.id);
    expect(rows.find((row) => row.id === 1)?.updatedAt).not.toBeNull();
    expect(rows.find((row) => row.id === 2)?.updatedAt).not.toBeNull();
    expect(rows.find((row) => row.id === 3)?.updatedAt).toBeNull();
    expect(rows.find((row) => row.id === 3)?.tagId).toBe(1);
  });

  it("retagMovements con ids inexistentes no da error y no computan en el recuento", async () => {
    const repository = new DrizzleMovementRepository(testDb.db);
    await insertMovement({ id: 1 });

    const result = await repository.retagMovements(
      AccountId(1),
      "2026-09",
      [MovementId(1), MovementId(999)],
      TagId(9),
    );

    expect(result).toEqual({ updated: 1 });
  });

  it("retagMovements acepta una lista con un único id", async () => {
    const repository = new DrizzleMovementRepository(testDb.db);
    await insertMovement({ id: 1 });

    const result = await repository.retagMovements(AccountId(1), "2026-09", [MovementId(1)], TagId(9));

    expect(result).toEqual({ updated: 1 });
  });

  it("retagMovements asigna el destino también a un ingreso con tag_id null", async () => {
    const repository = new DrizzleMovementRepository(testDb.db);
    await insertMovement({ id: 5, type: "income", nature: null, tagId: null, amountCents: 200_000 });

    const result = await repository.retagMovements(AccountId(1), "2026-09", [MovementId(5)], TagId(9));

    expect(result).toEqual({ updated: 1 });
    const row = (await testDb.db.select().from(movements)).find((movement) => movement.id === 5);
    expect(row?.tagId).toBe(9);
  });
});

describe("DrizzleMemberRepository", () => {
  it("findAll devuelve los miembros", async () => {
    const repository = new DrizzleMemberRepository(testDb.db);

    const result = await repository.findAll();

    expect(result.map((member) => member.name)).toEqual(["Miembro A", "Miembro B"]);
  });

  it("findById rehidrata la entidad o devuelve null", async () => {
    const repository = new DrizzleMemberRepository(testDb.db);

    const found = await repository.findById(MemberId(1));
    const missing = await repository.findById(MemberId(999));

    expect(found?.name).toBe("Miembro A");
    expect(missing).toBeNull();
  });

  it("findByName es nocase («isma» encuentra «Isma» tras renombrar)", async () => {
    const repository = new DrizzleMemberRepository(testDb.db);

    const exact = await repository.findByName("Miembro A");
    const missing = await repository.findByName("No existe");

    expect(exact?.id).toBe(1);
    expect(missing).toBeNull();

    await repository.update((await repository.findById(MemberId(1)))!.rename("Isma"));
    expect((await repository.findByName("isma"))?.id).toBe(1);
  });

  it("update persiste el renombrado y devuelve la entidad rehidratada", async () => {
    const repository = new DrizzleMemberRepository(testDb.db);
    const member = await repository.findById(MemberId(1));

    const updated = await repository.update(member!.rename("  Isma  "));

    expect(updated.name).toBe("Isma");
    expect(updated.id).toBe(1);
    const reloaded = await repository.findById(MemberId(1));
    expect(reloaded?.name).toBe("Isma");
  });

  it("update traduce la carrera del índice nocase a DuplicateMemberNameError", async () => {
    const repository = new DrizzleMemberRepository(testDb.db);
    const member = await repository.findById(MemberId(1));

    await expect(repository.update(member!.rename("MIEMBRO B"))).rejects.toThrowError(
      new DuplicateMemberNameError("MIEMBRO B"),
    );
  });
});
