import { describe, expect, it } from "vitest";

import { AccountId } from "@/domain/account/AccountId";
import { SavingsAllocation } from "@/domain/savings/SavingsAllocation";
import { SavingsPercentage } from "@/domain/savings/SavingsPercentage";
import { SavingsAllocationId } from "@/domain/savings/SavingsAllocationId";

import { GetMonthSavings } from "./GetMonthSavings";
import type { SavingsAllocationRepository } from "./SavingsAllocationRepository";

class InMemorySavingsAllocationRepository implements SavingsAllocationRepository {
  constructor(
    private readonly config: SavingsAllocation | null,
    private readonly deductedAmounts = new Map<string, number>(),
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

  async findDeductedAmount(
    allocationId: SavingsAllocationId,
    month: string,
  ): Promise<number | null> {
    return this.deductedAmounts.get(`${allocationId}:${month}`) ?? null;
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

describe("GetMonthSavings", () => {
  it("sin config → {configured: false, amountCents: 0}", async () => {
    const useCase = new GetMonthSavings(new InMemorySavingsAllocationRepository(null));

    expect(await useCase.execute(ACCOUNT_ID, "2026-10")).toEqual({
      configured: false,
      amountCents: 0,
    });
  });

  it("con config y fila del registro → el importe de la fila, nunca recálculo", async () => {
    const deducted = new Map([["1:2026-10", 30_000]]);
    const useCase = new GetMonthSavings(
      new InMemorySavingsAllocationRepository(config(), deducted),
    );

    expect(await useCase.execute(ACCOUNT_ID, "2026-10")).toEqual({
      configured: true,
      amountCents: 30_000,
    });
  });

  it("con config sin deducción en ese mes → {configured: true, amountCents: 0}", async () => {
    const useCase = new GetMonthSavings(new InMemorySavingsAllocationRepository(config()));

    expect(await useCase.execute(ACCOUNT_ID, "2026-10")).toEqual({
      configured: true,
      amountCents: 0,
    });
  });

  it.each(["2026-1", "2026-13", "octubre", ""])("mes inválido %j → throw Error", async (month) => {
    const useCase = new GetMonthSavings(new InMemorySavingsAllocationRepository(null));

    await expect(useCase.execute(ACCOUNT_ID, month)).rejects.toThrowError(
      `Mes inválido: ${month} (se espera YYYY-MM)`,
    );
  });
});
