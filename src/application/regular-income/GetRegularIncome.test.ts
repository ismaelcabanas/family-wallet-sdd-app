import { describe, expect, it } from "vitest";

import { AccountId } from "@/domain/account/AccountId";
import { Money } from "@/domain/movement/Money";
import { RegularIncome } from "@/domain/regular-income/RegularIncome";
import { RegularIncomeId } from "@/domain/regular-income/RegularIncomeId";

import { GetRegularIncome } from "./GetRegularIncome";
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
    dayOfMonth: 1,
    note: "Ingreso regular de Miembro A",
    active: true,
    activatedAtMonth: "2026-08",
  });
}

describe("GetRegularIncome", () => {
  it("devuelve el DTO cuando existe config", async () => {
    const useCase = new GetRegularIncome(new InMemoryRegularIncomeRepository(persistedConfig()));

    const dto = await useCase.execute(ACCOUNT_ID);

    expect(dto).toEqual({
      accountId: 1,
      amountCents: 200_000,
      dayOfMonth: 1,
      note: "Ingreso regular de Miembro A",
      active: true,
      activatedAtMonth: "2026-08",
    });
  });

  it("devuelve null cuando no existe config", async () => {
    const useCase = new GetRegularIncome(new InMemoryRegularIncomeRepository(null));

    const dto = await useCase.execute(ACCOUNT_ID);

    expect(dto).toBeNull();
  });
});
