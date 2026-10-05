import { AccountId } from "@/domain/account/AccountId";
import { Movement } from "@/domain/movement/Movement";
import { Money } from "@/domain/movement/Money";
import { Tag } from "@/domain/tag/Tag";
import { DuplicateTagNameError } from "@/domain/tag/TagErrors";
import { TagId } from "@/domain/tag/TagId";
import { beforeEach, describe, expect, it } from "vitest";

import { DrizzleAccountRepository } from "./DrizzleAccountRepository";
import { DrizzleMemberRepository } from "./DrizzleMemberRepository";
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
    { id: 1, name: "Cuenta de Miembro A", type: "personal", memberId: 1 },
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
  it("findAll devuelve las cuentas con la identidad y el nombre de su miembro", async () => {
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
  });

  it("findById devuelve la entidad o null", async () => {
    const repository = new DrizzleAccountRepository(testDb.db);

    const found = await repository.findById(AccountId(1));
    const missing = await repository.findById(AccountId(999));

    expect(found?.name).toBe("Cuenta de Miembro A");
    expect(found?.memberId).toBe(1);
    expect(missing).toBeNull();
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

    expect(active.map((tag) => tag.slug)).toEqual(["luz", "sin-clasificar"]);
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
});

describe("DrizzleMemberRepository", () => {
  it("findAll devuelve los miembros", async () => {
    const repository = new DrizzleMemberRepository(testDb.db);

    const result = await repository.findAll();

    expect(result.map((member) => member.name)).toEqual(["Miembro A", "Miembro B"]);
  });
});
