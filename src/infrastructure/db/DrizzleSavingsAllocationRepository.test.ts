import { AccountId } from "@/domain/account/AccountId";
import { SavingsAllocation } from "@/domain/savings/SavingsAllocation";
import { SavingsPercentage } from "@/domain/savings/SavingsPercentage";
import { beforeEach, describe, expect, it } from "vitest";

import { DrizzleSavingsAllocationRepository } from "./DrizzleSavingsAllocationRepository";
import { accounts } from "./schema/accounts";
import { members } from "./schema/members";
import { movements } from "./schema/movements";
import { savingsAllocationMonths, savingsAllocations } from "./schema/savings-allocations";
import { createTestDb, type TestDb } from "./test-support";

let testDb: TestDb;

beforeEach(async () => {
  testDb = await createTestDb();
  await testDb.db.insert(members).values({ id: 2, name: "Miembro B" });
  await testDb.db.insert(accounts).values([
    { id: 2, name: "Cuenta de Miembro B", type: "personal", memberId: 2 },
  ]);
});

function buildConfig(overrides: Partial<Parameters<typeof SavingsAllocation.create>[0]> = {}) {
  return SavingsAllocation.create({
    accountId: AccountId(2),
    percentage: SavingsPercentage.fromPercent(10),
    active: true,
    activatedAtMonth: "2026-10",
    ...overrides,
  });
}

describe("DrizzleSavingsAllocationRepository", () => {
  it("save inserta y devuelve la entidad con id; findByAccountId la rehidrata", async () => {
    const repository = new DrizzleSavingsAllocationRepository(testDb.db);

    const saved = await repository.save(buildConfig());

    expect(saved.id).not.toBeNull();
    const found = await repository.findByAccountId(AccountId(2));
    expect(found).toEqual(saved);
  });

  it("save hace upsert por account_id y devuelve la entidad persistida", async () => {
    const repository = new DrizzleSavingsAllocationRepository(testDb.db);

    const created = await repository.save(buildConfig());
    const updated = await repository.save(
      created.update({ percentage: SavingsPercentage.fromPercent(15) }),
    );

    const found = await repository.findByAccountId(AccountId(2));
    expect(found?.percentage.percent).toBe(15);
    expect(found?.id).toBe(updated.id);
    const rows = await testDb.db.select().from(savingsAllocations);
    expect(rows).toHaveLength(1);
  });

  it("isDeducted es falso antes y verdadero tras registerDeduction", async () => {
    const repository = new DrizzleSavingsAllocationRepository(testDb.db);
    const saved = await repository.save(buildConfig());

    expect(await repository.isDeducted(saved.id!, "2026-10")).toBe(false);

    const registered = await repository.registerDeduction(saved, "2026-10", 30_000);
    expect(registered).toBe(true);
    expect(await repository.isDeducted(saved.id!, "2026-10")).toBe(true);
    expect(await repository.isDeducted(saved.id!, "2026-11")).toBe(false);
  });

  it("registerDeduction inserta la fila del registro con amount_cents congelado", async () => {
    const repository = new DrizzleSavingsAllocationRepository(testDb.db);
    const saved = await repository.save(buildConfig());

    const registered = await repository.registerDeduction(saved, "2026-10", 30_000);

    expect(registered).toBe(true);
    const rows = await testDb.db.select().from(savingsAllocationMonths);
    expect(rows).toHaveLength(1);
    expect(rows[0].savingsAllocationId).toBe(saved.id as number);
    expect(rows[0].month).toBe("2026-10");
    expect(rows[0].amountCents).toBe(30_000);
  });

  it("la segunda inserción del mismo par (config, mes) devuelve false (perdió la carrera)", async () => {
    const repository = new DrizzleSavingsAllocationRepository(testDb.db);
    const saved = await repository.save(buildConfig());

    const first = await repository.registerDeduction(saved, "2026-10", 30_000);
    const second = await repository.registerDeduction(saved, "2026-10", 45_000);

    expect(first).toBe(true);
    expect(second).toBe(false);
    const rows = await testDb.db.select().from(savingsAllocationMonths);
    expect(rows).toHaveLength(1);
    expect(rows[0].amountCents).toBe(30_000);
  });

  it("findDeductedAmount devuelve el importe de la fila o null", async () => {
    const repository = new DrizzleSavingsAllocationRepository(testDb.db);
    const saved = await repository.save(buildConfig());

    expect(await repository.findDeductedAmount(saved.id!, "2026-10")).toBeNull();

    await repository.registerDeduction(saved, "2026-10", 30_000);

    expect(await repository.findDeductedAmount(saved.id!, "2026-10")).toBe(30_000);
    expect(await repository.findDeductedAmount(saved.id!, "2026-11")).toBeNull();
  });

  it("el registro no crea movimiento alguno en movements", async () => {
    const repository = new DrizzleSavingsAllocationRepository(testDb.db);
    const saved = await repository.save(buildConfig());

    await repository.registerDeduction(saved, "2026-10", 30_000);

    expect(await testDb.db.select().from(movements)).toHaveLength(0);
  });
});
