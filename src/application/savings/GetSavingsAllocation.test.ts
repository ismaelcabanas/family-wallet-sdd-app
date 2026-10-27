import { describe, expect, it } from "vitest";

import { AccountId } from "@/domain/account/AccountId";
import { SavingsAllocation } from "@/domain/savings/SavingsAllocation";
import { SavingsPercentage } from "@/domain/savings/SavingsPercentage";
import { SavingsAllocationId } from "@/domain/savings/SavingsAllocationId";

import { GetSavingsAllocation } from "./GetSavingsAllocation";
import type { SavingsAllocationRepository } from "./SavingsAllocationRepository";

class InMemorySavingsAllocationRepository implements SavingsAllocationRepository {
  constructor(private readonly config: SavingsAllocation | null) {}

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

  async findDeductedAmount(): Promise<number | null> {
    return null;
  }
}

const ACCOUNT_ID = AccountId(1);

describe("GetSavingsAllocation", () => {
  it("sin config → null", async () => {
    const useCase = new GetSavingsAllocation(new InMemorySavingsAllocationRepository(null));

    expect(await useCase.execute(ACCOUNT_ID)).toBeNull();
  });

  it("con config → SavingsAllocationDTO", async () => {
    const config = SavingsAllocation.rehydrate(SavingsAllocationId(1), {
      accountId: ACCOUNT_ID,
      percentage: SavingsPercentage.fromPercent(10),
      active: true,
      activatedAtMonth: "2026-09",
    });
    const useCase = new GetSavingsAllocation(
      new InMemorySavingsAllocationRepository(config),
    );

    const dto = await useCase.execute(ACCOUNT_ID);

    expect(dto).toEqual({
      accountId: 1,
      percentage: 10,
      active: true,
      activatedAtMonth: "2026-09",
    });
  });
});
