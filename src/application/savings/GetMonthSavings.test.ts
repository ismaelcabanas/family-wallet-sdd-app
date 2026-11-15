import { describe, expect, it } from "vitest";

import { AccountId } from "@/domain/account/AccountId";
import { Money } from "@/domain/movement/Money";
import { Movement } from "@/domain/movement/Movement";
import { TagId } from "@/domain/tag/TagId";
import { SavingsAllocation } from "@/domain/savings/SavingsAllocation";
import { SavingsPercentage } from "@/domain/savings/SavingsPercentage";
import { SavingsAllocationId } from "@/domain/savings/SavingsAllocationId";

import { GetMonthSavings } from "./GetMonthSavings";
import type { SavingsAllocationRepository } from "./SavingsAllocationRepository";

class InMemorySavingsAllocationRepository implements SavingsAllocationRepository {
  constructor(
    private readonly config: SavingsAllocation | null,
    private readonly deductedAmounts = new Map<string, number>(),
    private readonly deductedMovements = new Map<string, Movement | null>(),
  ) {}

  async findByAccountId(): Promise<SavingsAllocation | null> {
    return this.config;
  }

  async save(): Promise<SavingsAllocation> {
    throw new Error("no aplicable en este test");
  }

  async isDeducted(): Promise<boolean> {
    return false;
  }

  async registerDeduction(): Promise<boolean> {
    return false;
  }

  async registerMaterialization(): Promise<boolean> {
    return false;
  }

  async registerManualSavings(): Promise<never> {
    throw new Error("no aplicable en este test");
  }

  async findDeductedAmount(
    allocationId: SavingsAllocationId,
    month: string,
  ): Promise<number | null> {
    return this.deductedAmounts.get(`${allocationId}:${month}`) ?? null;
  }

  async findDeductedMovement(
    allocationId: SavingsAllocationId,
    month: string,
  ): Promise<Movement | null> {
    return this.deductedMovements.get(`${allocationId}:${month}`) ?? null;
  }

  async findDeductedMonthByMovement(): Promise<string | null> {
    return null;
  }

  async withdrawDeductionForMovement(): Promise<boolean> {
    return false;
  }
}

const ACCOUNT_ID = AccountId(1);

function config() {
  return SavingsAllocation.rehydrate(SavingsAllocationId(1), {
    accountId: ACCOUNT_ID,
    percentage: SavingsPercentage.fromPercent(10),
    active: true,
    activatedAtMonth: "2026-09",
  });
}

function savingsMovement(amountCents: number): Movement {
  return Movement.rehydrate({
    id: 10,
    accountId: ACCOUNT_ID,
    type: "expense",
    date: "2026-10-01",
    note: "Ahorro",
    amount: Money.fromCents(amountCents),
    nature: "personal",
    tagId: TagId(101),
    createdAt: "2026-10-01T08:00:00.000Z",
  });
}

describe("GetMonthSavings", () => {
  it("sin config → {configured: false, amountCents: 0, backedByMovement: false}", async () => {
    const useCase = new GetMonthSavings(new InMemorySavingsAllocationRepository(null));

    expect(await useCase.execute(ACCOUNT_ID, "2026-10")).toEqual({
      configured: false,
      amountCents: 0,
      backedByMovement: false,
    });
  });

  it("con movimiento enlazado → importe del movimiento y backedByMovement true (nunca recálculo)", async () => {
    const useCase = new GetMonthSavings(
      new InMemorySavingsAllocationRepository(
        config(),
        new Map([["1:2026-10", 12_345]]),
        new Map([["1:2026-10", savingsMovement(30_000)]]),
      ),
    );

    expect(await useCase.execute(ACCOUNT_ID, "2026-10")).toEqual({
      configured: true,
      amountCents: 30_000,
      backedByMovement: true,
    });
  });

  it("con fila huérfana (legacy sin movimiento) → importe congelado y backedByMovement false", async () => {
    const useCase = new GetMonthSavings(
      new InMemorySavingsAllocationRepository(
        config(),
        new Map([["1:2026-10", 30_000]]),
        new Map([["1:2026-10", null]]),
      ),
    );

    expect(await useCase.execute(ACCOUNT_ID, "2026-10")).toEqual({
      configured: true,
      amountCents: 30_000,
      backedByMovement: false,
    });
  });

  it("con config sin fila en ese mes → {configured: true, amountCents: 0, backedByMovement: false}", async () => {
    const useCase = new GetMonthSavings(new InMemorySavingsAllocationRepository(config()));

    expect(await useCase.execute(ACCOUNT_ID, "2026-10")).toEqual({
      configured: true,
      amountCents: 0,
      backedByMovement: false,
    });
  });

  it.each(["2026-1", "2026-13", "octubre", ""])("mes inválido %j → throw Error", async (month) => {
    const useCase = new GetMonthSavings(new InMemorySavingsAllocationRepository(null));

    await expect(useCase.execute(ACCOUNT_ID, month)).rejects.toThrowError(
      `Mes inválido: ${month} (se espera YYYY-MM)`,
    );
  });
});
