import { describe, expect, it } from "vitest";

import type { AccountRepository } from "../account/AccountRepository";
import type { AccountDTO } from "../movement/dto";
import type { RegularIncomeRepository } from "../regular-income/RegularIncomeRepository";
import { AccountId } from "@/domain/account/AccountId";
import { Account } from "@/domain/account/Account";
import { AccountNotFoundError } from "@/domain/account/AccountErrors";
import { Money } from "@/domain/movement/Money";
import { RegularIncome } from "@/domain/regular-income/RegularIncome";
import { RegularIncomeId } from "@/domain/regular-income/RegularIncomeId";
import { SavingsAllocation } from "@/domain/savings/SavingsAllocation";
import { SavingsPercentage } from "@/domain/savings/SavingsPercentage";
import { SavingsAllocationId } from "@/domain/savings/SavingsAllocationId";
import {
  InvalidSavingsAllocationError,
  MissingRegularIncomeError,
  SharedAccountSavingsError,
} from "@/domain/savings/SavingsAllocationErrors";

import { ConfigureSavingsAllocation } from "./ConfigureSavingsAllocation";
import type { SavingsAllocationRepository } from "./SavingsAllocationRepository";

class InMemorySavingsAllocationRepository implements SavingsAllocationRepository {
  private readonly configsByAccountId = new Map<number, SavingsAllocation>();
  private nextId = 1;

  async findByAccountId(accountId: AccountId): Promise<SavingsAllocation | null> {
    return this.configsByAccountId.get(accountId as number) ?? null;
  }

  async save(config: SavingsAllocation): Promise<SavingsAllocation> {
    let persisted = config;
    if (config.id === null) {
      persisted = SavingsAllocation.rehydrate(this.nextId, {
        accountId: config.accountId,
        percentage: config.percentage,
        active: config.active,
        activatedAtMonth: config.activatedAtMonth,
      });
      this.nextId += 1;
    }
    this.configsByAccountId.set(persisted.accountId as number, persisted);
    return persisted;
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

class InMemoryRegularIncomeRepository implements RegularIncomeRepository {
  constructor(private readonly config: RegularIncome | null) {}

  async findByAccountId(): Promise<RegularIncome | null> {
    return this.config;
  }

  async save(): Promise<RegularIncome> {
    throw new Error("no aplicable en este test");
  }

  async isMaterialized(): Promise<boolean> {
    return false;
  }

  async registerMaterialization(): Promise<boolean> {
    return false;
  }
}

class InMemoryAccountRepository implements AccountRepository {
  constructor(private readonly rows: AccountDTO[]) {}

  async findAll(): Promise<AccountDTO[]> {
    return this.rows;
  }

  async findById(id: AccountId): Promise<Account | null> {
    const row = this.rows.find((candidate) => candidate.id === (id as number));
    return row
      ? Account.rehydrate(
          row.id,
          row.name,
          row.type,
          row.memberId === null ? null : (row.memberId as never),
        )
      : null;
  }

  async getBalance(): Promise<number> {
    return 0;
  }
}

const MEMBER_A_ACCOUNT: AccountDTO = {
  id: 1,
  name: "Cuenta de Miembro A",
  type: "personal",
  memberId: 1,
  memberName: "Miembro A",
};

const SHARED_ACCOUNT: AccountDTO = {
  id: 3,
  name: "Cuenta común",
  type: "shared",
  memberId: null,
  memberName: null,
};

function regularIncome(overrides: Partial<Parameters<typeof RegularIncome.rehydrate>[0]> = {}) {
  return RegularIncome.rehydrate({
    id: RegularIncomeId(11),
    accountId: AccountId(1),
    amount: Money.fromCents(300_000),
    dayOfMonth: 1,
    note: "Ingreso regular de Miembro A",
    active: true,
    activatedAtMonth: "2026-10",
    ...overrides,
  });
}

function buildUseCase(options: {
  accounts?: AccountDTO[];
  regularIncome?: RegularIncome | null;
} = {}) {
  const savings = new InMemorySavingsAllocationRepository();
  const useCase = new ConfigureSavingsAllocation(
    savings,
    new InMemoryRegularIncomeRepository(
      options.regularIncome === undefined ? regularIncome() : options.regularIncome,
    ),
    new InMemoryAccountRepository(options.accounts ?? [MEMBER_A_ACCOUNT, SHARED_ACCOUNT]),
  );
  return { savings, useCase };
}

const CURRENT_MONTH = "2026-10";

describe("ConfigureSavingsAllocation", () => {
  it("el alta nace activa con activatedAtMonth = mes en curso", async () => {
    const { useCase } = buildUseCase();

    const dto = await useCase.execute({ accountId: 1, percentage: 10, currentMonth: CURRENT_MONTH });

    expect(dto).toEqual({
      accountId: 1,
      percentage: 10,
      active: true,
      activatedAtMonth: CURRENT_MONTH,
    });
  });

  it("la edición conserva activatedAtMonth", async () => {
    const { savings, useCase } = buildUseCase();

    await savings.save(
      SavingsAllocation.rehydrate(SavingsAllocationId(1), {
        accountId: AccountId(1),
        percentage: SavingsPercentage.fromPercent(10),
        active: true,
        activatedAtMonth: "2026-06",
      }),
    );

    const dto = await useCase.execute({ accountId: 1, percentage: 15, currentMonth: CURRENT_MONTH });

    expect(dto.percentage).toBe(15);
    expect(dto.active).toBe(true);
    expect(dto.activatedAtMonth).toBe("2026-06");
  });

  it("la reactivación de una config inactiva resetea activatedAtMonth al mes en curso", async () => {
    const { savings, useCase } = buildUseCase();

    await savings.save(
      SavingsAllocation.rehydrate(SavingsAllocationId(1), {
        accountId: AccountId(1),
        percentage: SavingsPercentage.fromPercent(10),
        active: false,
        activatedAtMonth: "2026-05",
      }),
    );

    const dto = await useCase.execute({ accountId: 1, percentage: 10, currentMonth: CURRENT_MONTH });

    expect(dto.active).toBe(true);
    expect(dto.activatedAtMonth).toBe(CURRENT_MONTH);
  });

  it("cuenta no encontrada → AccountNotFoundError", async () => {
    const { useCase } = buildUseCase();

    await expect(
      useCase.execute({ accountId: 99, percentage: 10, currentMonth: CURRENT_MONTH }),
    ).rejects.toThrowError(AccountNotFoundError);
  });

  it("cuenta común → SharedAccountSavingsError", async () => {
    const { useCase } = buildUseCase();

    await expect(
      useCase.execute({ accountId: 3, percentage: 10, currentMonth: CURRENT_MONTH }),
    ).rejects.toThrowError(SharedAccountSavingsError);
  });

  it("sin ingreso regular → MissingRegularIncomeError", async () => {
    const { useCase } = buildUseCase({ regularIncome: null });

    await expect(
      useCase.execute({ accountId: 1, percentage: 10, currentMonth: CURRENT_MONTH }),
    ).rejects.toThrowError(MissingRegularIncomeError);
  });

  it("ingreso con el que el porcentaje redondea a 0 céntimos → InvalidSavingsAllocationError con literal congelado", async () => {
    const { useCase } = buildUseCase({
      regularIncome: regularIncome({ amount: Money.fromCents(4) }),
    });

    try {
      await useCase.execute({ accountId: 1, percentage: 10, currentMonth: CURRENT_MONTH });
      expect.unreachable("debía lanzar InvalidSavingsAllocationError");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidSavingsAllocationError);
      expect((error as InvalidSavingsAllocationError).field).toBe("percentage");
      expect((error as Error).message).toBe(
        "El porcentaje aplicado a tu ingreso regular debe resultar en al menos 0,01 €.",
      );
    }
  });
});
