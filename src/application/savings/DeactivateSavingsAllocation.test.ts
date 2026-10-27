import { describe, expect, it } from "vitest";

import { AccountId } from "@/domain/account/AccountId";
import { SavingsAllocation } from "@/domain/savings/SavingsAllocation";
import { SavingsPercentage } from "@/domain/savings/SavingsPercentage";
import { SavingsAllocationId } from "@/domain/savings/SavingsAllocationId";
import { SavingsAllocationNotFoundError } from "@/domain/savings/SavingsAllocationErrors";

import { DeactivateSavingsAllocation } from "./DeactivateSavingsAllocation";
import type { SavingsAllocationRepository } from "./SavingsAllocationRepository";

class InMemorySavingsAllocationRepository implements SavingsAllocationRepository {
  private readonly configsByAccountId = new Map<number, SavingsAllocation>();

  async findByAccountId(accountId: AccountId): Promise<SavingsAllocation | null> {
    return this.configsByAccountId.get(accountId as number) ?? null;
  }

  async save(config: SavingsAllocation): Promise<SavingsAllocation> {
    this.configsByAccountId.set(config.accountId as number, config);
    return config;
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

describe("DeactivateSavingsAllocation", () => {
  it("desactiva la config conservando activatedAtMonth", async () => {
    const savings = new InMemorySavingsAllocationRepository();
    await savings.save(
      SavingsAllocation.rehydrate(SavingsAllocationId(1), {
        accountId: ACCOUNT_ID,
        percentage: SavingsPercentage.fromPercent(10),
        active: true,
        activatedAtMonth: "2026-06",
      }),
    );
    const useCase = new DeactivateSavingsAllocation(savings);

    const dto = await useCase.execute(ACCOUNT_ID);

    expect(dto).toEqual({
      accountId: 1,
      percentage: 10,
      active: false,
      activatedAtMonth: "2026-06",
    });
  });

  it("sin config → SavingsAllocationNotFoundError", async () => {
    const useCase = new DeactivateSavingsAllocation(new InMemorySavingsAllocationRepository());

    await expect(useCase.execute(ACCOUNT_ID)).rejects.toThrowError(
      SavingsAllocationNotFoundError,
    );
  });
});
