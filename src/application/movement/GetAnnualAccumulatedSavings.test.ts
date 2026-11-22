import { AccountId } from "@/domain/account/AccountId";
import type { Movement } from "@/domain/movement/Movement";
import { SavingsAllocation } from "@/domain/savings/SavingsAllocation";
import { SavingsAllocationId } from "@/domain/savings/SavingsAllocationId";
import { SavingsPercentage } from "@/domain/savings/SavingsPercentage";
import type {
  DeductedMonthEntry,
  SavingsAllocationRepository,
} from "@/application/savings/SavingsAllocationRepository";
import { describe, expect, it } from "vitest";

import type { MovementDTO } from "./dto";
import { GetAnnualAccumulatedSavings } from "./GetAnnualAccumulatedSavings";
import type { MovementRepository } from "./MovementRepository";

class FakeMovementRepository implements MovementRepository {
  listByYearAndAccountCalls: string[] = [];

  constructor(private readonly yearRows: MovementDTO[]) {}

  async listByYearAndAccount(accountId: AccountId, year: string): Promise<MovementDTO[]> {
    this.listByYearAndAccountCalls.push(`${accountId}:${year}`);
    return this.yearRows;
  }

  async create(): Promise<never> {
    throw new Error("no usado en este test");
  }
  async listByMonthAndAccount(): Promise<MovementDTO[]> {
    return [];
  }
  async listByMonth(): Promise<MovementDTO[]> {
    return [];
  }
  async listByYear(): Promise<MovementDTO[]> {
    return [];
  }
  async findById(): Promise<Movement | null> {
    return null;
  }
  async update(): Promise<void> {}
  async delete(): Promise<void> {}
  async sumSharedExpenseCents(): Promise<number> {
    return 0;
  }
  async retagMovements(): Promise<{ updated: number }> {
    return { updated: 0 };
  }
}

class FakeSavingsAllocationRepository implements SavingsAllocationRepository {
  findByAccountIdCalls = 0;
  findDeductedMonthsOfYearCalls: string[] = [];

  constructor(
    private readonly config: SavingsAllocation | null,
    private readonly monthsOfYear: DeductedMonthEntry[] = [],
  ) {}

  async findByAccountId(): Promise<SavingsAllocation | null> {
    this.findByAccountIdCalls += 1;
    return this.config;
  }

  async findDeductedMonthsOfYear(
    allocationId: SavingsAllocationId,
    year: string,
  ): Promise<readonly DeductedMonthEntry[]> {
    this.findDeductedMonthsOfYearCalls.push(`${allocationId}:${year}`);
    return this.monthsOfYear;
  }

  async save(): Promise<never> {
    throw new Error("no usado en este test");
  }
  async isDeducted(): Promise<boolean> {
    return false;
  }
  async registerMaterialization(): Promise<boolean> {
    return false;
  }
  async registerManualSavings(): Promise<null> {
    return null;
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

function movement(overrides: Partial<MovementDTO>): MovementDTO {
  return {
    id: 1,
    accountId: 2,
    type: "expense",
    date: "2026-03-10",
    note: "Movimiento",
    amountCents: 0,
    nature: "personal",
    tag: null,
    ...overrides,
  };
}

function savingsConfig(): SavingsAllocation {
  return SavingsAllocation.rehydrate(SavingsAllocationId(4), {
    accountId: AccountId(2),
    percentage: SavingsPercentage.fromPercent(10),
    active: true,
    activatedAtMonth: "2026-01",
  });
}

describe("GetAnnualAccumulatedSavings", () => {
  it("suma con signo los saldos netos de los 12 meses del año, exacta al céntimo", async () => {
    const movements = new FakeMovementRepository([
      movement({ id: 1, type: "income", nature: null, date: "2026-03-01", amountCents: 100_000 }),
      movement({ id: 2, date: "2026-03-20", amountCents: 20_050 }),
      movement({ id: 3, date: "2026-07-15", amountCents: 180_000 }),
    ]);
    const savings = new FakeSavingsAllocationRepository(savingsConfig(), [
      { month: "2026-03", amountCents: 5_000, backedByMovement: true },
      { month: "2026-06", amountCents: 3_000, backedByMovement: false },
    ]);
    const useCase = new GetAnnualAccumulatedSavings(movements, savings);

    const result = await useCase.execute(2, "2026");

    expect(result).toEqual({ accumulatedCents: 79_950 - 180_000 - 3_000 });
  });

  it("año vacío sin config de ahorro → accumulatedCents 0", async () => {
    const movements = new FakeMovementRepository([]);
    const savings = new FakeSavingsAllocationRepository(null);
    const useCase = new GetAnnualAccumulatedSavings(movements, savings);

    const result = await useCase.execute(2, "2030");

    expect(result).toEqual({ accumulatedCents: 0 });
  });

  it.each(["26", "20266", "20a6", ""])("year %j fuera de YYYY → Error", async (year) => {
    const useCase = new GetAnnualAccumulatedSavings(
      new FakeMovementRepository([]),
      new FakeSavingsAllocationRepository(null),
    );

    await expect(useCase.execute(2, year)).rejects.toThrow(/Año inválido/);
  });

  it("sin config de ahorro computa cero deducciones (solo movimientos)", async () => {
    const movements = new FakeMovementRepository([
      movement({ id: 1, type: "income", nature: null, date: "2026-11-02", amountCents: 50_000 }),
    ]);
    const savings = new FakeSavingsAllocationRepository(null);
    const useCase = new GetAnnualAccumulatedSavings(movements, savings);

    const result = await useCase.execute(2, "2026");

    expect(result).toEqual({ accumulatedCents: 50_000 });
    expect(savings.findByAccountIdCalls).toBe(1);
    expect(savings.findDeductedMonthsOfYearCalls).toHaveLength(0);
  });

  it("aplica la composición 033: legacy congelada descuenta, respaldada por movimiento no", async () => {
    const movements = new FakeMovementRepository([
      movement({ id: 1, type: "income", nature: null, date: "2026-01-05", amountCents: 100_000 }),
    ]);
    const savings = new FakeSavingsAllocationRepository(savingsConfig(), [
      { month: "2026-01", amountCents: 10_000, backedByMovement: true },
      { month: "2026-02", amountCents: 4_000, backedByMovement: false },
    ]);
    const useCase = new GetAnnualAccumulatedSavings(movements, savings);

    const result = await useCase.execute(2, "2026");

    expect(result).toEqual({ accumulatedCents: 100_000 - 4_000 });
  });

  it("cada mes computa como máximo una vez: una lectura del año y una de deducciones", async () => {
    const movements = new FakeMovementRepository([
      movement({ id: 1, type: "income", nature: null, date: "2026-05-05", amountCents: 10_000 }),
      movement({ id: 2, date: "2026-05-25", amountCents: 2_000 }),
      movement({ id: 3, date: "2026-09-15", amountCents: 3_000 }),
    ]);
    const savings = new FakeSavingsAllocationRepository(savingsConfig(), [
      { month: "2026-05", amountCents: 1_000, backedByMovement: false },
    ]);
    const useCase = new GetAnnualAccumulatedSavings(movements, savings);

    const result = await useCase.execute(2, "2026");

    expect(movements.listByYearAndAccountCalls).toEqual(["2:2026"]);
    expect(savings.findDeductedMonthsOfYearCalls).toEqual(["4:2026"]);
    expect(result).toEqual({ accumulatedCents: 10_000 - 2_000 - 1_000 - 3_000 });
  });
});
