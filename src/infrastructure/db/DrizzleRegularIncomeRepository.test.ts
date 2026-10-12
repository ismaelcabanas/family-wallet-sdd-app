import { AccountId } from "@/domain/account/AccountId";
import { Money } from "@/domain/movement/Money";
import { Movement } from "@/domain/movement/Movement";
import { RegularIncome } from "@/domain/regular-income/RegularIncome";
import { beforeEach, describe, expect, it } from "vitest";

import { DrizzleAccountRepository } from "./DrizzleAccountRepository";
import { DrizzleMovementRepository } from "./DrizzleMovementRepository";
import { DrizzleRegularIncomeRepository } from "./DrizzleRegularIncomeRepository";
import { accounts } from "./schema/accounts";
import { members } from "./schema/members";
import { movements } from "./schema/movements";
import { regularIncomes } from "./schema/regular-incomes";
import { createTestDb, type TestDb } from "./test-support";

let testDb: TestDb;

beforeEach(async () => {
  testDb = await createTestDb();
  await testDb.db.insert(members).values({ id: 1, name: "Miembro A" });
  await testDb.db.insert(accounts).values([
    { id: 1, name: "Cuenta de Miembro A", type: "personal", memberId: 1 },
  ]);
});

function buildConfig(overrides: Partial<Parameters<typeof RegularIncome.create>[0]> = {}) {
  return RegularIncome.create({
    accountId: AccountId(1),
    amount: Money.fromCents(200_000),
    dayOfMonth: 1,
    note: "Ingreso regular de Miembro A",
    active: true,
    activatedAtMonth: "2026-10",
    ...overrides,
  });
}

function buildMovement(overrides: Partial<Parameters<typeof Movement.create>[0]> = {}) {
  return Movement.create({
    accountId: AccountId(1),
    type: "income",
    date: "2026-10-01",
    note: "Ingreso regular de Miembro A",
    amount: Money.fromCents(200_000),
    nature: null,
    tagId: null,
    ...overrides,
  });
}

describe("DrizzleRegularIncomeRepository", () => {
  it("save inserta y devuelve la entidad con id; findByAccountId la rehidrata", async () => {
    const repository = new DrizzleRegularIncomeRepository(testDb.db);

    const saved = await repository.save(buildConfig());

    expect(saved.id).not.toBeNull();
    const found = await repository.findByAccountId(AccountId(1));
    expect(found).toEqual(saved);
  });

  it("save hace upsert por account_id y devuelve la entidad persistida", async () => {
    const repository = new DrizzleRegularIncomeRepository(testDb.db);

    const created = await repository.save(buildConfig());
    const updated = await repository.save(created.update({ amount: Money.fromCents(210_000) }));

    const found = await repository.findByAccountId(AccountId(1));
    expect(found?.amount.amountCents).toBe(210_000);
    expect(found?.id).toBe(updated.id);
    const rows = await testDb.db.select().from(regularIncomes);
    expect(rows).toHaveLength(1);
  });

  it("isMaterialized es falso antes y verdadero tras registerMaterialization", async () => {
    const repository = new DrizzleRegularIncomeRepository(testDb.db);
    const saved = await repository.save(buildConfig());

    expect(await repository.isMaterialized(saved.id!, "2026-10")).toBe(false);

    const registered = await repository.registerMaterialization(saved, "2026-10", buildMovement());
    expect(registered).toBe(true);
    expect(await repository.isMaterialized(saved.id!, "2026-10")).toBe(true);
    expect(await repository.isMaterialized(saved.id!, "2026-11")).toBe(false);
  });

  it("registerMaterialization inserta la fila y el movimiento en una tx", async () => {
    const repository = new DrizzleRegularIncomeRepository(testDb.db);
    const saved = await repository.save(buildConfig());

    const registered = await repository.registerMaterialization(saved, "2026-10", buildMovement());

    expect(registered).toBe(true);
    const [movementRow] = await testDb.db.select().from(movements);
    expect(movementRow.accountId).toBe(1);
    expect(movementRow.type).toBe("income");
    expect(movementRow.date).toBe("2026-10-01");
    expect(movementRow.amountCents).toBe(200_000);
    expect(movementRow.nature).toBeNull();
    expect(movementRow.tagId).toBeNull();
  });

  it("la segunda inserción del mismo par devuelve false sin crear movimiento", async () => {
    const repository = new DrizzleRegularIncomeRepository(testDb.db);
    const saved = await repository.save(buildConfig());

    const first = await repository.registerMaterialization(saved, "2026-10", buildMovement());
    const second = await repository.registerMaterialization(
      saved,
      "2026-10",
      buildMovement({ amount: Money.fromCents(999_999) }),
    );

    expect(first).toBe(true);
    expect(second).toBe(false);
    const movementRows = await testDb.db.select().from(movements);
    expect(movementRows).toHaveLength(1);
    expect(movementRows[0].amountCents).toBe(200_000);
  });

  it("el movimiento creado es visible a listByMonthAndAccount y a getBalance", async () => {
    const repository = new DrizzleRegularIncomeRepository(testDb.db);
    const movementRepository = new DrizzleMovementRepository(testDb.db);
    const accountRepository = new DrizzleAccountRepository(testDb.db);
    const saved = await repository.save(buildConfig());

    await repository.registerMaterialization(saved, "2026-10", buildMovement());

    const listed = await movementRepository.listByMonthAndAccount(AccountId(1), "2026-10");
    expect(listed).toHaveLength(1);
    expect(listed[0].amountCents).toBe(200_000);
    expect(listed[0].note).toBe("Ingreso regular de Miembro A");

    const balance = await accountRepository.getBalance(AccountId(1), "2026-10-31");
    expect(balance).toBe(200_000);
  });
});
