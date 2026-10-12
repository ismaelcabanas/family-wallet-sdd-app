import { describe, expect, it } from "vitest";

import { AccountId } from "@/domain/account/AccountId";
import { Money } from "@/domain/movement/Money";
import { RegularIncome } from "@/domain/regular-income/RegularIncome";
import { RegularIncomeId } from "@/domain/regular-income/RegularIncomeId";
import { RegularIncomeNotFoundError } from "@/domain/regular-income/RegularIncomeErrors";

import { DeactivateRegularIncome } from "./DeactivateRegularIncome";
import type { RegularIncomeRepository } from "./RegularIncomeRepository";

class InMemoryRegularIncomeRepository implements RegularIncomeRepository {
  private config: RegularIncome | null;

  constructor(config: RegularIncome | null) {
    this.config = config;
  }

  async findByAccountId(accountId?: AccountId): Promise<RegularIncome | null> {
    void accountId;
    return this.config;
  }

  async save(config: RegularIncome): Promise<RegularIncome> {
    this.config = config;
    return config;
  }

  async isMaterialized(): Promise<boolean> {
    return false;
  }

  async registerMaterialization(): Promise<boolean> {
    return false;
  }
}

const ACCOUNT_ID = AccountId(1);

function persistedConfig() {
  return RegularIncome.rehydrate({
    id: RegularIncomeId(4),
    accountId: ACCOUNT_ID,
    amount: Money.fromCents(200_000),
    dayOfMonth: 5,
    note: "Nómina",
    active: true,
    activatedAtMonth: "2026-08",
  });
}

describe("DeactivateRegularIncome", () => {
  it("desactiva conservando valores y activatedAtMonth", async () => {
    const repo = new InMemoryRegularIncomeRepository(persistedConfig());
    const useCase = new DeactivateRegularIncome(repo);

    const dto = await useCase.execute(ACCOUNT_ID);

    expect(dto).toEqual({
      accountId: 1,
      amountCents: 200_000,
      dayOfMonth: 5,
      note: "Nómina",
      active: false,
      activatedAtMonth: "2026-08",
    });
    expect((await repo.findByAccountId(ACCOUNT_ID))?.active).toBe(false);
  });

  it("sin config → RegularIncomeNotFoundError", async () => {
    const useCase = new DeactivateRegularIncome(new InMemoryRegularIncomeRepository(null));

    await expect(useCase.execute(ACCOUNT_ID)).rejects.toThrowError(RegularIncomeNotFoundError);
  });
});
