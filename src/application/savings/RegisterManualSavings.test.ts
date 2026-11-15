import { describe, expect, it } from "vitest";

import { Account } from "@/domain/account/Account";
import { AccountId } from "@/domain/account/AccountId";
import { AccountNotFoundError } from "@/domain/account/AccountErrors";
import { MemberId } from "@/domain/member/MemberId";
import { Movement } from "@/domain/movement/Movement";
import { MovementId } from "@/domain/movement/MovementId";
import { Money } from "@/domain/movement/Money";
import {
  SavingsAllocationNotFoundError,
  SavingsAlreadyExistsError,
  SharedAccountSavingsError,
} from "@/domain/savings/SavingsAllocationErrors";
import { SavingsAllocation } from "@/domain/savings/SavingsAllocation";
import { SavingsAllocationId } from "@/domain/savings/SavingsAllocationId";
import { SavingsPercentage } from "@/domain/savings/SavingsPercentage";
import { Tag } from "@/domain/tag/Tag";
import { TagCategoryId } from "@/domain/tag-category/TagCategoryId";
import { TagId } from "@/domain/tag/TagId";

import type { AccountRepository } from "../account/AccountRepository";
import type { TagRepository } from "../tag/TagRepository";
import { RegisterManualSavings } from "./RegisterManualSavings";

const ACCOUNT_ID = AccountId(1);
const SAVINGS_TAG = Tag.rehydrate(101, "Ahorro", "ahorro", "active", TagCategoryId(1));

class StubSavingsAllocationRepository {
  existingByMonth = new Map<string, Movement | null>();
  registered: Array<{ configId: number; month: string; movement: Movement }> = [];
  registerResult: MovementId | null = null;

  config: SavingsAllocation | null = SavingsAllocation.rehydrate(SavingsAllocationId(4), {
    accountId: ACCOUNT_ID,
    percentage: SavingsPercentage.fromPercent(10),
    active: false,
    activatedAtMonth: "2026-11",
  });

  async findByAccountId(): Promise<SavingsAllocation | null> {
    return this.config;
  }

  async save(config: SavingsAllocation): Promise<SavingsAllocation> {
    return config;
  }

  async isDeducted(): Promise<boolean> {
    return false;
  }

  async registerMaterialization(): Promise<boolean> {
    return false;
  }

  async registerManualSavings(
    config: SavingsAllocation,
    month: string,
    movement: Movement,
  ): Promise<MovementId | null> {
    this.registered.push({ configId: config.id as number, month, movement });
    return this.registerResult;
  }

  async findDeductedAmount(): Promise<number | null> {
    return null;
  }

  async findDeductedMovement(_allocationId: unknown, month: string): Promise<Movement | null> {
    return this.existingByMonth.get(month) ?? null;
  }

  async findDeductedMonthByMovement(): Promise<string | null> {
    return null;
  }

  async withdrawDeductionForMovement(): Promise<boolean> {
    return false;
  }
}

function buildTags(): TagRepository {
  return {
    findAllActive: async () => [],
    findByIds: async () => [],
    findBySlug: async (slug) => (slug === "ahorro" ? SAVINGS_TAG : null),
    findByName: async () => null,
    save: async (tag) => tag,
    findById: async () => null,
    findAll: async () => [],
    update: async (tag) => tag,
    mergeInto: async () => ({ reassignedMovements: 0 }),
  };
}

describe("RegisterManualSavings", () => {
  const personalAccount = Account.rehydrate(1, "Cuenta de Miembro A", "personal", MemberId(1));
  const sharedAccount = Account.rehydrate(3, "Cuenta común", "shared", null);

  function buildAccounts(account: Account | null): AccountRepository {
    return {
      findAll: async () => [],
      findById: async () => account,
      findByName: async () => null,
      update: async (current) => current,
    };
  }

  it("crea el movimiento de ahorro y escribe la fila del registro en la misma llamada", async () => {
    const savingsAllocations = new StubSavingsAllocationRepository();
    savingsAllocations.registerResult = MovementId(11);
    const useCase = new RegisterManualSavings(
      savingsAllocations,
      buildAccounts(personalAccount),
      buildTags(),
    );

    const movementId = await useCase.execute({
      accountId: 1,
      date: "2026-05-14",
      note: "Ahorro mayo",
      amountCents: 25_000,
    });

    expect(movementId).toBe(11);
    expect(savingsAllocations.registered).toHaveLength(1);
    const { configId, month, movement } = savingsAllocations.registered[0];
    expect(configId).toBe(4);
    expect(month).toBe("2026-05");
    expect(movement.type).toBe("expense");
    expect(movement.nature).toBe("personal");
    expect(movement.tagId).toBe(TagId(101));
    expect(movement.amount).toEqual(Money.fromCents(25_000));
    expect(movement.note).toBe("Ahorro mayo");
    expect(movement.date).toBe("2026-05-14");
  });

  it("admite el registro con config inactiva (la config es un mero ancla, FR-006)", async () => {
    const savingsAllocations = new StubSavingsAllocationRepository();
    savingsAllocations.config = SavingsAllocation.rehydrate(SavingsAllocationId(4), {
      accountId: ACCOUNT_ID,
      percentage: SavingsPercentage.fromPercent(10),
      active: false,
      activatedAtMonth: "2026-11",
    });
    savingsAllocations.registerResult = MovementId(12);
    const useCase = new RegisterManualSavings(
      savingsAllocations,
      buildAccounts(personalAccount),
      buildTags(),
    );

    const movementId = await useCase.execute({
      accountId: 1,
      date: "2026-04-10",
      note: "",
      amountCents: 15_000,
    });

    expect(movementId).toBe(12);
    expect(savingsAllocations.registered).toHaveLength(1);
  });

  it("deriva la nota por defecto «Ahorro» cuando el usuario no teclea ninguna", async () => {
    const savingsAllocations = new StubSavingsAllocationRepository();
    savingsAllocations.registerResult = MovementId(13);
    const useCase = new RegisterManualSavings(
      savingsAllocations,
      buildAccounts(personalAccount),
      buildTags(),
    );

    await useCase.execute({ accountId: 1, date: "2026-05-14", note: "", amountCents: 5_000 });

    expect(savingsAllocations.registered[0].movement.note).toBe("Ahorro");
  });

  it("rechaza el duplicado si el mes ya tiene movimiento de ahorro enlazado (FR-001)", async () => {
    const savingsAllocations = new StubSavingsAllocationRepository();
    savingsAllocations.existingByMonth.set("2026-05", Movement.rehydrate({
      id: 10,
      accountId: ACCOUNT_ID,
      type: "expense",
      date: "2026-05-01",
      note: "Ahorro",
      amount: Money.fromCents(20_000),
      nature: "personal",
      tagId: TagId(101),
      createdAt: "2026-05-01T08:00:00.000Z",
    }));
    const useCase = new RegisterManualSavings(
      savingsAllocations,
      buildAccounts(personalAccount),
      buildTags(),
    );

    await expect(
      useCase.execute({ accountId: 1, date: "2026-05-20", note: "Otro", amountCents: 1_000 }),
    ).rejects.toThrowError(SavingsAlreadyExistsError);
    expect(savingsAllocations.registered).toHaveLength(0);
  });

  it("admite el registro en un mes con fila huérfana (sin movimiento enlazado, FR-002)", async () => {
    const savingsAllocations = new StubSavingsAllocationRepository();
    savingsAllocations.existingByMonth.set("2026-05", null);
    savingsAllocations.registerResult = MovementId(14);
    const useCase = new RegisterManualSavings(
      savingsAllocations,
      buildAccounts(personalAccount),
      buildTags(),
    );

    const movementId = await useCase.execute({
      accountId: 1,
      date: "2026-05-14",
      note: "Re-enlace",
      amountCents: 20_000,
    });

    expect(movementId).toBe(14);
    expect(savingsAllocations.registered).toHaveLength(1);
  });

  it("rechaza con SavingsAlreadyExistsError si la escritura atómica detecta conflicto (carrera)", async () => {
    const savingsAllocations = new StubSavingsAllocationRepository();
    savingsAllocations.registerResult = null;
    const useCase = new RegisterManualSavings(
      savingsAllocations,
      buildAccounts(personalAccount),
      buildTags(),
    );

    await expect(
      useCase.execute({ accountId: 1, date: "2026-05-14", note: "Carrera", amountCents: 1_000 }),
    ).rejects.toThrowError(SavingsAlreadyExistsError);
  });

  it("rechaza si la cuenta no tiene config de ahorro (aunque exista)", async () => {
    const savingsAllocations = new StubSavingsAllocationRepository();
    savingsAllocations.config = null;
    const useCase = new RegisterManualSavings(
      savingsAllocations,
      buildAccounts(personalAccount),
      buildTags(),
    );

    await expect(
      useCase.execute({ accountId: 1, date: "2026-05-14", note: "X", amountCents: 1_000 }),
    ).rejects.toThrowError(SavingsAllocationNotFoundError);
  });

  it("rechaza en la cuenta común (defensa de servidor)", async () => {
    const useCase = new RegisterManualSavings(
      new StubSavingsAllocationRepository(),
      buildAccounts(sharedAccount),
      buildTags(),
    );

    await expect(
      useCase.execute({ accountId: 3, date: "2026-05-14", note: "X", amountCents: 1_000 }),
    ).rejects.toThrowError(SharedAccountSavingsError);
  });

  it("rechaza si la cuenta no existe", async () => {
    const useCase = new RegisterManualSavings(
      new StubSavingsAllocationRepository(),
      buildAccounts(null),
      buildTags(),
    );

    await expect(
      useCase.execute({ accountId: 99, date: "2026-05-14", note: "X", amountCents: 1_000 }),
    ).rejects.toThrowError(AccountNotFoundError);
  });
});
