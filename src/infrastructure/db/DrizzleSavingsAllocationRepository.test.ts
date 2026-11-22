import { AccountId } from "@/domain/account/AccountId";
import { Movement } from "@/domain/movement/Movement";
import { MovementId } from "@/domain/movement/MovementId";
import { Money } from "@/domain/movement/Money";
import { TagId } from "@/domain/tag/TagId";
import { SavingsAllocation } from "@/domain/savings/SavingsAllocation";
import { SavingsPercentage } from "@/domain/savings/SavingsPercentage";
import { beforeEach, describe, expect, it } from "vitest";

import { DrizzleSavingsAllocationRepository } from "./DrizzleSavingsAllocationRepository";
import { accounts } from "./schema/accounts";
import { members } from "./schema/members";
import { movements } from "./schema/movements";
import { tags } from "./schema/tags";
import { savingsAllocationMonths, savingsAllocations } from "./schema/savings-allocations";
import { createTestDb, type TestDb } from "./test-support";

let testDb: TestDb;
let savingsTagId: TagId;

beforeEach(async () => {
  testDb = await createTestDb();
  await testDb.db.insert(members).values({ id: 2, name: "Miembro B" });
  await testDb.db.insert(accounts).values([
    { id: 2, name: "Cuenta de Miembro B", type: "personal", memberId: 2 },
  ]);
  const ahorroTag = (await testDb.db.select().from(tags)).find((tag) => tag.slug === "ahorro");
  expect(ahorroTag).toBeDefined();
  savingsTagId = TagId(ahorroTag!.id);
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

function buildMovement(overrides: Partial<Parameters<typeof Movement.create>[0]> = {}) {
  return Movement.create({
    accountId: AccountId(2),
    type: "expense",
    date: "2026-05-10",
    note: "Ahorro",
    amount: Money.fromCents(25_000),
    nature: "personal",
    tagId: savingsTagId,
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

  it("isDeducted es falso antes y verdadero tras registerMaterialization", async () => {
    const repository = new DrizzleSavingsAllocationRepository(testDb.db);
    const saved = await repository.save(buildConfig());

    expect(await repository.isDeducted(saved.id!, "2026-10")).toBe(false);

    const registered = await repository.registerMaterialization(saved, "2026-10", buildMovement({
      date: "2026-10-01",
    }));
    expect(registered).toBe(true);
    expect(await repository.isDeducted(saved.id!, "2026-10")).toBe(true);
    expect(await repository.isDeducted(saved.id!, "2026-11")).toBe(false);
  });

  it("findDeductedAmount devuelve el importe de la fila o null", async () => {
    const repository = new DrizzleSavingsAllocationRepository(testDb.db);
    const saved = await repository.save(buildConfig());

    expect(await repository.findDeductedAmount(saved.id!, "2026-10")).toBeNull();

    await repository.registerMaterialization(saved, "2026-10", buildMovement({
      date: "2026-10-01",
    }));

    expect(await repository.findDeductedAmount(saved.id!, "2026-10")).toBe(25_000);
    expect(await repository.findDeductedAmount(saved.id!, "2026-11")).toBeNull();
  });

  it("la migración 0009 sembró la etiqueta protegida «Ahorro» en la categoría genérica", async () => {
    const ahorro = (await testDb.db.select().from(tags)).find((tag) => tag.slug === "ahorro");

    expect(ahorro?.name).toBe("Ahorro");
    expect(ahorro?.status).toBe("active");
    expect(ahorro?.categoryId).not.toBeNull();
  });

  it("registerManualSavings inserta fila enlazada y movimiento en la misma transacción", async () => {
    const repository = new DrizzleSavingsAllocationRepository(testDb.db);
    const saved = await repository.save(buildConfig());

    const movementId = await repository.registerManualSavings(saved, "2026-05", buildMovement());

    expect(movementId).not.toBeNull();
    const rows = await testDb.db.select().from(savingsAllocationMonths);
    expect(rows).toHaveLength(1);
    expect(rows[0].month).toBe("2026-05");
    expect(rows[0].movementId).toBe(movementId as number);
    expect(rows[0].amountCents).toBe(25_000);

    const [movementRow] = await testDb.db.select().from(movements);
    expect(movementRow.id).toBe(movementId as number);
    expect(movementRow.note).toBe("Ahorro");
    expect(movementRow.nature).toBe("personal");
    expect(movementRow.tagId).toBe(savingsTagId as number);
  });

  it("registerManualSavings re-enlaza una huérfana legacy sincronizando amount_cents", async () => {
    const repository = new DrizzleSavingsAllocationRepository(testDb.db);
    const saved = await repository.save(buildConfig());
    await testDb.db.insert(savingsAllocationMonths).values({
      savingsAllocationId: saved.id as number,
      month: "2026-05",
      amountCents: 12_345,
      createdAt: new Date().toISOString(),
    });

    const movementId = await repository.registerManualSavings(
      saved,
      "2026-05",
      buildMovement({ amount: Money.fromCents(25_000) }),
    );

    expect(movementId).not.toBeNull();
    const rows = await testDb.db.select().from(savingsAllocationMonths);
    expect(rows).toHaveLength(1);
    expect(rows[0].movementId).toBe(movementId as number);
    expect(rows[0].amountCents).toBe(25_000);
  });

  it("registerManualSavings devuelve null si el mes ya está enlazado, sin insertar movimiento", async () => {
    const repository = new DrizzleSavingsAllocationRepository(testDb.db);
    const saved = await repository.save(buildConfig());

    const first = await repository.registerManualSavings(saved, "2026-05", buildMovement());
    const second = await repository.registerManualSavings(
      saved,
      "2026-05",
      buildMovement({ amount: Money.fromCents(99_999) }),
    );

    expect(first).not.toBeNull();
    expect(second).toBeNull();
    expect(await testDb.db.select().from(movements)).toHaveLength(1);
    const [row] = await testDb.db.select().from(savingsAllocationMonths);
    expect(row.amountCents).toBe(25_000);
  });

  it("registerMaterialization inserta fila y movimiento atómicos y es idempotente", async () => {
    const repository = new DrizzleSavingsAllocationRepository(testDb.db);
    const saved = await repository.save(buildConfig());

    const first = await repository.registerMaterialization(saved, "2026-10", buildMovement({
      date: "2026-10-01",
    }));
    const second = await repository.registerMaterialization(saved, "2026-10", buildMovement({
      date: "2026-10-01",
      amount: Money.fromCents(40_000),
    }));

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(await testDb.db.select().from(movements)).toHaveLength(1);
    const rows = await testDb.db.select().from(savingsAllocationMonths);
    expect(rows).toHaveLength(1);
    expect(rows[0].amountCents).toBe(25_000);
    expect(rows[0].movementId).not.toBeNull();
  });

  it("findDeductedMovement devuelve el movimiento enlazado y null para huérfanas", async () => {
    const repository = new DrizzleSavingsAllocationRepository(testDb.db);
    const saved = await repository.save(buildConfig());
    await testDb.db.insert(savingsAllocationMonths).values({
      savingsAllocationId: saved.id as number,
      month: "2026-04",
      amountCents: 10_000,
      createdAt: new Date().toISOString(),
    });

    expect(await repository.findDeductedMovement(saved.id!, "2026-04")).toBeNull();

    const movementId = await repository.registerManualSavings(saved, "2026-05", buildMovement());
    const movement = await repository.findDeductedMovement(saved.id!, "2026-05");

    expect(movement?.id).toBe(movementId);
    expect(movement?.amount.amountCents).toBe(25_000);
    expect(await repository.findDeductedMovement(saved.id!, "2026-06")).toBeNull();
  });

  it("findDeductedMonthByMovement devuelve el mes enlazado o null", async () => {
    const repository = new DrizzleSavingsAllocationRepository(testDb.db);
    const saved = await repository.save(buildConfig());
    const movementId = await repository.registerManualSavings(saved, "2026-05", buildMovement());

    expect(await repository.findDeductedMonthByMovement(movementId!)).toBe("2026-05");
    expect(await repository.findDeductedMonthByMovement(MovementId(999_999))).toBeNull();
  });

  it("withdrawDeductionForMovement borra movimiento y fila juntos (uniforme)", async () => {
    const repository = new DrizzleSavingsAllocationRepository(testDb.db);
    const saved = await repository.save(buildConfig());
    const movementId = await repository.registerManualSavings(saved, "2026-05", buildMovement());

    const withdrew = await repository.withdrawDeductionForMovement(movementId!);

    expect(withdrew).toBe(true);
    expect(await testDb.db.select().from(movements)).toHaveLength(0);
    expect(await testDb.db.select().from(savingsAllocationMonths)).toHaveLength(0);
    expect(await repository.withdrawDeductionForMovement(movementId!)).toBe(false);
  });

  describe("findDeductedMonthsOfYear", () => {
    it("fila respaldada por movimiento existente → backedByMovement true; huérfana → false", async () => {
      const repository = new DrizzleSavingsAllocationRepository(testDb.db);
      const saved = await repository.save(buildConfig());
      await repository.registerManualSavings(saved, "2026-03", buildMovement({ amount: Money.fromCents(30_000) }));
      await testDb.db.insert(savingsAllocationMonths).values({
        savingsAllocationId: saved.id as number,
        month: "2026-08",
        amountCents: 12_345,
        movementId: 999_999,
        createdAt: new Date().toISOString(),
      });

      const entries = await repository.findDeductedMonthsOfYear(saved.id!, "2026");

      expect(entries).toHaveLength(2);
      expect(entries).toContainEqual({
        month: "2026-03",
        amountCents: 30_000,
        backedByMovement: true,
      });
      expect(entries).toContainEqual({
        month: "2026-08",
        amountCents: 12_345,
        backedByMovement: false,
      });
    });

    it("excluye filas de otros años y de otras configs", async () => {
      const repository = new DrizzleSavingsAllocationRepository(testDb.db);
      const saved = await repository.save(buildConfig());
      await testDb.db.insert(accounts).values([
        { id: 3, name: "Cuenta común", type: "shared", memberId: null },
      ]);
      const otherConfig = await repository.save(
        buildConfig({ accountId: AccountId(3) }),
      );
      await testDb.db.insert(savingsAllocationMonths).values([
        {
          savingsAllocationId: saved.id as number,
          month: "2026-05",
          amountCents: 25_000,
          createdAt: new Date().toISOString(),
        },
        {
          savingsAllocationId: saved.id as number,
          month: "2025-12",
          amountCents: 11_111,
          createdAt: new Date().toISOString(),
        },
        {
          savingsAllocationId: saved.id as number,
          month: "2027-01",
          amountCents: 22_222,
          createdAt: new Date().toISOString(),
        },
        {
          savingsAllocationId: otherConfig.id as number,
          month: "2026-06",
          amountCents: 33_333,
          createdAt: new Date().toISOString(),
        },
      ]);

      const entries = await repository.findDeductedMonthsOfYear(saved.id!, "2026");

      expect(entries).toEqual([
        { month: "2026-05", amountCents: 25_000, backedByMovement: false },
      ]);
    });

    it("config sin filas en el año → array vacío", async () => {
      const repository = new DrizzleSavingsAllocationRepository(testDb.db);
      const saved = await repository.save(buildConfig());

      expect(await repository.findDeductedMonthsOfYear(saved.id!, "2026")).toEqual([]);
    });
  });
});
