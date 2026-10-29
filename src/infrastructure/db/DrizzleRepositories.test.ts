import { AccountId } from "@/domain/account/AccountId";
import { DuplicateAccountNameError } from "@/domain/account/AccountErrors";
import { Movement } from "@/domain/movement/Movement";
import { Money } from "@/domain/movement/Money";
import { DuplicateMemberNameError } from "@/domain/member/MemberErrors";
import { MemberId } from "@/domain/member/MemberId";
import { Tag } from "@/domain/tag/Tag";
import { DuplicateTagNameError } from "@/domain/tag/TagErrors";
import { TagId } from "@/domain/tag/TagId";
import { beforeEach, describe, expect, it } from "vitest";

import { DrizzleAccountRepository } from "./DrizzleAccountRepository";
import { DrizzleMemberRepository } from "./DrizzleMemberRepository";
import { DrizzleMovementRepository } from "./DrizzleMovementRepository";
import { DrizzleTagRepository } from "./DrizzleTagRepository";
import { accounts } from "./schema/accounts";
import { members } from "./schema/members";
import { movements } from "./schema/movements";
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
    { id: 1, name: "Luz", slug: "luz", status: "active" },
    { id: 2, name: "Inactiva", slug: "inactiva", status: "inactive" },
    { id: 9, name: "Sin Clasificar", slug: "sin-clasificar", status: "active" },
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

  it("getBalance calcula ingresos − gastos de todo el histórico con exactitud (SC-003)", async () => {
    const repository = new DrizzleAccountRepository(testDb.db);
    const create = async (overrides: Partial<Parameters<typeof Movement.create>[0]>) => {
      const movement = buildMovement(overrides);
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
    };

    await create({ type: "income", nature: null, amount: Money.fromCents(150_000) });
    await create({ amount: Money.fromCents(1_029) });
    await create({ amount: Money.fromCents(1) });
    await create({ amount: Money.fromCents(1) });

    const balance = await repository.getBalance(AccountId(1));

    expect(balance).toBe(150_000 - 1_029 - 1 - 1);
  });

  it("getBalance devuelve 0 para una cuenta sin movimientos", async () => {
    const repository = new DrizzleAccountRepository(testDb.db);
    expect(await repository.getBalance(AccountId(3))).toBe(0);
  });

  it("getBalance con asOf incluye el movimiento fechado exactamente el corte (inclusive)", async () => {
    const repository = new DrizzleAccountRepository(testDb.db);
    const create = async (overrides: Partial<Parameters<typeof Movement.create>[0]>) => {
      const movement = buildMovement(overrides);
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
    };

    await create({ type: "income", nature: null, amount: Money.fromCents(100_000), date: "2026-03-31" });
    await create({ amount: Money.fromCents(5_000), date: "2026-04-30" });
    await create({ amount: Money.fromCents(2_500), date: "2026-05-01" });

    const balance = await repository.getBalance(AccountId(1), "2026-04-30");

    expect(balance).toBe(100_000 - 5_000);
  });

  it("getBalance con asOf excluye los movimientos posteriores al corte", async () => {
    const repository = new DrizzleAccountRepository(testDb.db);
    const create = async (overrides: Partial<Parameters<typeof Movement.create>[0]>) => {
      const movement = buildMovement(overrides);
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
    };

    await create({ amount: Money.fromCents(1_000), date: "2026-01-15" });
    await create({ amount: Money.fromCents(9_999), date: "2026-06-01" });

    const balance = await repository.getBalance(AccountId(1), "2026-05-31");

    expect(balance).toBe(-1_000);
  });

  it("getBalance con asOf devuelve 0 (no null ni NaN) si no hay movimientos ≤ corte", async () => {
    const repository = new DrizzleAccountRepository(testDb.db);
    const movement = buildMovement({ date: "2026-09-15", note: "Futuro" });
    await testDb.db.insert(movements).values({
      accountId: movement.accountId as number,
      type: movement.type,
      date: movement.date,
      note: movement.note,
      amountCents: movement.amount.amountCents,
      nature: movement.nature,
      tagId: movement.tagId as number,
      createdAt: movement.createdAt,
    });

    const balance = await repository.getBalance(AccountId(1), "2025-12-31");

    expect(balance).toBe(0);
    expect(Number.isNaN(balance)).toBe(false);
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
      testDb.db.insert(tags).values({ name: "LUZ", slug: "luz-duplicada", status: "active" }),
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

  it("save persiste la etiqueta y la devuelve con id asignado", async () => {
    const repository = new DrizzleTagRepository(testDb.db);
    const tag = Tag.create({ name: "Mascotas", slug: "mascotas", status: "active" });

    const saved = await repository.save(tag);
    const reloaded = await repository.findBySlug("mascotas");

    expect(saved.id).not.toBeNull();
    expect(saved.name).toBe("Mascotas");
    expect(saved.status).toBe("active");
    expect(reloaded?.id).toBe(saved.id);
  });

  it("save traduce la violación del constraint de nombre a DuplicateTagNameError (carrera)", async () => {
    const repository = new DrizzleTagRepository(testDb.db);
    const tag = Tag.create({ name: "LUZ", slug: "luz-2", status: "active" });

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

  it("update persiste el renombrado con slug estable y devuelve la entidad rehidratada", async () => {
    const repository = new DrizzleTagRepository(testDb.db);
    const tag = await repository.findById(TagId(1));

    const updated = await repository.update(
      (tag as Tag).rename("Hogar"),
    );

    expect(updated.name).toBe("Hogar");
    expect(updated.slug).toBe("luz");
    const reloaded = await repository.findById(TagId(1));
    expect(reloaded?.name).toBe("Hogar");
    expect(reloaded?.slug).toBe("luz");
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

  it("mergeInto con absorbida sin movimientos devuelve 0 y borra", async () => {
    const repository = new DrizzleTagRepository(testDb.db);

    const result = await repository.mergeInto(TagId(1), TagId(9));

    expect(result.reassignedMovements).toBe(0);
    expect(await repository.findById(TagId(1))).toBeNull();
    expect((await repository.findAll()).map((tag) => tag.slug)).not.toContain("luz");
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
