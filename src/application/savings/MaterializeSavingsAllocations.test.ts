import { describe, expect, it } from "vitest";

import type { RegularIncomeRepository } from "../regular-income/RegularIncomeRepository";
import { AccountId } from "@/domain/account/AccountId";
import { Money } from "@/domain/movement/Money";
import { RegularIncome } from "@/domain/regular-income/RegularIncome";
import { RegularIncomeId } from "@/domain/regular-income/RegularIncomeId";
import { SavingsAllocation } from "@/domain/savings/SavingsAllocation";
import { SavingsPercentage } from "@/domain/savings/SavingsPercentage";
import { SavingsAllocationId } from "@/domain/savings/SavingsAllocationId";

import { MaterializeSavingsAllocations } from "./MaterializeSavingsAllocations";
import type { SavingsAllocationRepository } from "./SavingsAllocationRepository";

class InMemorySavingsAllocationRepository implements SavingsAllocationRepository {
  private readonly configsByAccountId = new Map<number, SavingsAllocation>();
  private readonly deductedAmounts = new Map<string, number>();
  registerDeductionCalls: Array<{ allocationId: number; month: string; amountCents: number }> = [];
  forceLoseRace = false;
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

  async isDeducted(allocationId: SavingsAllocationId, month: string): Promise<boolean> {
    return this.deductedAmounts.has(`${allocationId}:${month}`);
  }

  async registerDeduction(
    config: SavingsAllocation,
    month: string,
    amountCents: number,
  ): Promise<boolean> {
    if (config.id === null) {
      throw new Error("registerDeduction requiere una config persistida");
    }
    this.registerDeductionCalls.push({
      allocationId: config.id as number,
      month,
      amountCents,
    });
    if (this.forceLoseRace) {
      return false;
    }
    const key = `${config.id}:${month}`;
    if (this.deductedAmounts.has(key)) {
      return false;
    }
    this.deductedAmounts.set(key, amountCents);
    return true;
  }

  async findDeductedAmount(
    allocationId: SavingsAllocationId,
    month: string,
  ): Promise<number | null> {
    return this.deductedAmounts.get(`${allocationId}:${month}`) ?? null;
  }
}

class InMemoryRegularIncomeRepository implements RegularIncomeRepository {
  constructor(private config: RegularIncome | null) {}

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

const ACCOUNT_ID = AccountId(1);
const ACTIVATED_AT = "2026-09";
const CURRENT_MONTH = "2026-10";

function income(overrides: Partial<Parameters<typeof RegularIncome.rehydrate>[0]> = {}) {
  return RegularIncome.rehydrate({
    id: RegularIncomeId(11),
    accountId: ACCOUNT_ID,
    amount: Money.fromCents(300_000),
    dayOfMonth: 1,
    note: "Ingreso regular de Miembro A",
    active: true,
    activatedAtMonth: "2026-08",
    ...overrides,
  });
}

async function seedConfig(
  savings: InMemorySavingsAllocationRepository,
  overrides: Partial<Parameters<typeof SavingsAllocation.rehydrate>[1]> = {},
) {
  return savings.save(
    SavingsAllocation.rehydrate(SavingsAllocationId(1), {
      accountId: ACCOUNT_ID,
      percentage: SavingsPercentage.fromPercent(10),
      active: true,
      activatedAtMonth: ACTIVATED_AT,
      ...overrides,
    }),
  );
}

function buildUseCase(incomeConfig: RegularIncome | null = income()) {
  const savings = new InMemorySavingsAllocationRepository();
  const useCase = new MaterializeSavingsAllocations(
    savings,
    new InMemoryRegularIncomeRepository(incomeConfig),
  );
  return { savings, useCase };
}

describe("MaterializeSavingsAllocations", () => {
  it("la primera consulta de un mes en ventana registra la deducción con el importe calculado", async () => {
    const { savings, useCase } = buildUseCase();
    await seedConfig(savings);

    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);

    expect(savings.registerDeductionCalls).toEqual([
      { allocationId: 1, month: CURRENT_MONTH, amountCents: 30_000 },
    ]);
    expect(await savings.findDeductedAmount(SavingsAllocationId(1), CURRENT_MONTH)).toBe(30_000);
  });

  it("la consulta repetida del mismo mes no duplica (isDeducted → no-op)", async () => {
    const { savings, useCase } = buildUseCase();
    await seedConfig(savings);

    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);
    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);

    expect(savings.registerDeductionCalls).toHaveLength(1);
  });

  it("un mes anterior a activatedAtMonth nunca se deduce (sin retroactivo)", async () => {
    const { savings, useCase } = buildUseCase();
    await seedConfig(savings);

    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, "2026-08", CURRENT_MONTH);

    expect(savings.registerDeductionCalls).toHaveLength(0);
  });

  it("un mes posterior a currentMonth nunca se deduce (futuro)", async () => {
    const { savings, useCase } = buildUseCase();
    await seedConfig(savings);

    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, "2026-11", CURRENT_MONTH);

    expect(savings.registerDeductionCalls).toHaveLength(0);
  });

  it("un mes ya registrado no se reajusta tras cambiar el porcentaje (importe congelado)", async () => {
    const { savings, useCase } = buildUseCase();
    await seedConfig(savings);

    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, "2026-09", CURRENT_MONTH);
    await savings.save(
      (await savings.findByAccountId(ACCOUNT_ID))!.update({
        percentage: SavingsPercentage.fromPercent(15),
      }),
    );
    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, "2026-09", CURRENT_MONTH);

    expect(await savings.findDeductedAmount(SavingsAllocationId(1), "2026-09")).toBe(30_000);
    expect(savings.registerDeductionCalls).toHaveLength(1);

    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);
    expect(savings.registerDeductionCalls).toHaveLength(2);
    expect(savings.registerDeductionCalls[1]).toEqual({
      allocationId: 1,
      month: CURRENT_MONTH,
      amountCents: 45_000,
    });
  });

  it("un cambio del importe del ingreso no toca el mes ya registrado y aplica al pendiente", async () => {
    const { savings, useCase } = buildUseCase();
    const config = await seedConfig(savings);

    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);
    const withNewIncome = new MaterializeSavingsAllocations(
      savings,
      new InMemoryRegularIncomeRepository(income({ amount: Money.fromCents(400_000) })),
    );
    await withNewIncome.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);

    expect(await savings.findDeductedAmount(config.id!, CURRENT_MONTH)).toBe(30_000);
  });

  it("sin config → no-op", async () => {
    const { savings, useCase } = buildUseCase();

    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);

    expect(savings.registerDeductionCalls).toHaveLength(0);
  });

  it("config inactiva → no-op", async () => {
    const { savings, useCase } = buildUseCase();
    await seedConfig(savings, { active: false });

    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);

    expect(savings.registerDeductionCalls).toHaveLength(0);
  });

  it("sin ingreso regular → no-op sin registrar el mes (mes abierto)", async () => {
    const { savings, useCase } = buildUseCase(null);
    await seedConfig(savings);

    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);

    expect(savings.registerDeductionCalls).toHaveLength(0);
    expect(await savings.isDeducted(SavingsAllocationId(1), CURRENT_MONTH)).toBe(false);
  });

  it("ingreso regular inactivo → no-op sin registrar el mes (mes abierto)", async () => {
    const { savings, useCase } = buildUseCase(income({ active: false }));
    await seedConfig(savings);

    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);

    expect(savings.registerDeductionCalls).toHaveLength(0);
    expect(await savings.isDeducted(SavingsAllocationId(1), CURRENT_MONTH)).toBe(false);
  });

  it("cálculo < 1 céntimo → no-op sin registrar", async () => {
    const { savings, useCase } = buildUseCase(income({ amount: Money.fromCents(4) }));
    await seedConfig(savings, {
      percentage: SavingsPercentage.fromPercent(10),
    });

    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);

    expect(savings.registerDeductionCalls).toHaveLength(0);
    expect(await savings.isDeducted(SavingsAllocationId(1), CURRENT_MONTH)).toBe(false);
  });

  it("carrera (registerDeduction devuelve false) → no-op silencioso", async () => {
    const { savings, useCase } = buildUseCase();
    await seedConfig(savings);
    savings.forceLoseRace = true;

    await expect(
      useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH),
    ).resolves.toBeUndefined();
  });
});
