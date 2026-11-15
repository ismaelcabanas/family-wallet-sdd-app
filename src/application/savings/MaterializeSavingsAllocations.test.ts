import { describe, expect, it } from "vitest";

import type { RegularIncomeRepository } from "../regular-income/RegularIncomeRepository";
import type { TagRepository } from "../tag/TagRepository";
import { AccountId } from "@/domain/account/AccountId";
import { Money } from "@/domain/movement/Money";
import { Movement } from "@/domain/movement/Movement";
import { RegularIncome } from "@/domain/regular-income/RegularIncome";
import { RegularIncomeId } from "@/domain/regular-income/RegularIncomeId";
import { SavingsAllocation } from "@/domain/savings/SavingsAllocation";
import { SavingsPercentage } from "@/domain/savings/SavingsPercentage";
import { SavingsAllocationId } from "@/domain/savings/SavingsAllocationId";
import { Tag } from "@/domain/tag/Tag";
import { TagCategoryId } from "@/domain/tag-category/TagCategoryId";
import { TagId } from "@/domain/tag/TagId";

import { MaterializeSavingsAllocations } from "./MaterializeSavingsAllocations";
import type { SavingsAllocationRepository } from "./SavingsAllocationRepository";

const SAVINGS_TAG = Tag.rehydrate(101, "Ahorro", "ahorro", "active", TagCategoryId(1));

class InMemorySavingsAllocationRepository implements SavingsAllocationRepository {
  private readonly configsByAccountId = new Map<number, SavingsAllocation>();
  private readonly deductedMonths = new Set<string>();
  registerMaterializationCalls: Array<{ allocationId: number; month: string; movement: Movement }> =
    [];
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
    return this.deductedMonths.has(`${allocationId}:${month}`);
  }

  async registerMaterialization(
    config: SavingsAllocation,
    month: string,
    movement: Movement,
  ): Promise<boolean> {
    if (config.id === null) {
      throw new Error("registerMaterialization requiere una config persistida");
    }
    if (this.forceLoseRace) {
      return false;
    }
    const key = `${config.id}:${month}`;
    if (this.deductedMonths.has(key)) {
      return false;
    }
    this.deductedMonths.add(key);
    this.registerMaterializationCalls.push({
      allocationId: config.id as number,
      month,
      movement,
    });
    return true;
  }

  async registerManualSavings(): Promise<never> {
    throw new Error("no aplicable en este test");
  }

  async findDeductedAmount(): Promise<number | null> {
    return null;
  }

  async findDeductedMovement(): Promise<Movement | null> {
    return null;
  }

  async findDeductedMonthByMovement(): Promise<string | null> {
    return null;
  }

  async withdrawDeductionForMovement(): Promise<boolean> {
    return false;
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

const tagsRepository: TagRepository = {
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
  const useCase = new MaterializeSavingsAllocations(savings, new InMemoryRegularIncomeRepository(incomeConfig), tagsRepository);
  return { savings, useCase };
}

describe("MaterializeSavingsAllocations", () => {
  it("la primera consulta de un mes en ventana registra fila y movimiento en la misma llamada", async () => {
    const { savings, useCase } = buildUseCase();
    await seedConfig(savings);

    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);

    expect(savings.registerMaterializationCalls).toHaveLength(1);
    const { allocationId, month, movement } = savings.registerMaterializationCalls[0];
    expect(allocationId).toBe(1);
    expect(month).toBe(CURRENT_MONTH);
    expect(movement.type).toBe("expense");
    expect(movement.nature).toBe("personal");
    expect(movement.tagId).toBe(TagId(101));
    expect(movement.note).toBe("Ahorro");
    expect(movement.date).toBe(`${CURRENT_MONTH}-01`);
    expect(movement.amount).toEqual(Money.fromCents(30_000));
  });

  it("la consulta repetida del mismo mes no duplica (isDeducted → no-op)", async () => {
    const { savings, useCase } = buildUseCase();
    await seedConfig(savings);

    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);
    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);

    expect(savings.registerMaterializationCalls).toHaveLength(1);
  });

  it("un mes anterior a activatedAtMonth nunca se materializa (sin retroactivo)", async () => {
    const { savings, useCase } = buildUseCase();
    await seedConfig(savings);

    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, "2026-08", CURRENT_MONTH);

    expect(savings.registerMaterializationCalls).toHaveLength(0);
  });

  it("un mes posterior a currentMonth nunca se materializa (futuro)", async () => {
    const { savings, useCase } = buildUseCase();
    await seedConfig(savings);

    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, "2026-11", CURRENT_MONTH);

    expect(savings.registerMaterializationCalls).toHaveLength(0);
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

    expect(savings.registerMaterializationCalls).toHaveLength(1);
    expect(savings.registerMaterializationCalls[0].movement.amount.amountCents).toBe(30_000);

    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);
    expect(savings.registerMaterializationCalls).toHaveLength(2);
    expect(savings.registerMaterializationCalls[1].movement.amount).toEqual(
      Money.fromCents(45_000),
    );
  });

  it("un cambio del importe del ingreso no toca el mes ya registrado y aplica al pendiente", async () => {
    const { savings, useCase } = buildUseCase();
    const config = await seedConfig(savings);

    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);
    const withNewIncome = new MaterializeSavingsAllocations(
      savings,
      new InMemoryRegularIncomeRepository(income({ amount: Money.fromCents(400_000) })),
      tagsRepository,
    );
    await withNewIncome.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);

    expect(savings.registerMaterializationCalls).toHaveLength(1);
    expect(savings.registerMaterializationCalls[0].movement.amount.amountCents).toBe(30_000);
    expect(config.id).not.toBeNull();
  });

  it("sin config → no-op", async () => {
    const { savings, useCase } = buildUseCase();

    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);

    expect(savings.registerMaterializationCalls).toHaveLength(0);
  });

  it("config inactiva → no-op", async () => {
    const { savings, useCase } = buildUseCase();
    await seedConfig(savings, { active: false });

    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);

    expect(savings.registerMaterializationCalls).toHaveLength(0);
  });

  it("sin ingreso regular → no-op sin registrar el mes (mes abierto)", async () => {
    const { savings, useCase } = buildUseCase(null);
    await seedConfig(savings);

    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);

    expect(savings.registerMaterializationCalls).toHaveLength(0);
    expect(await savings.isDeducted(SavingsAllocationId(1), CURRENT_MONTH)).toBe(false);
  });

  it("ingreso regular inactivo → no-op sin registrar el mes (mes abierto)", async () => {
    const { savings, useCase } = buildUseCase(income({ active: false }));
    await seedConfig(savings);

    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);

    expect(savings.registerMaterializationCalls).toHaveLength(0);
    expect(await savings.isDeducted(SavingsAllocationId(1), CURRENT_MONTH)).toBe(false);
  });

  it("cálculo < 1 céntimo → no-op sin registrar", async () => {
    const { savings, useCase } = buildUseCase(income({ amount: Money.fromCents(4) }));
    await seedConfig(savings, {
      percentage: SavingsPercentage.fromPercent(10),
    });

    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);

    expect(savings.registerMaterializationCalls).toHaveLength(0);
    expect(await savings.isDeducted(SavingsAllocationId(1), CURRENT_MONTH)).toBe(false);
  });

  it("carrera (registerMaterialization devuelve false) → no-op silencioso", async () => {
    const { savings, useCase } = buildUseCase();
    await seedConfig(savings);
    savings.forceLoseRace = true;

    await expect(
      useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH),
    ).resolves.toBeUndefined();
  });
});
