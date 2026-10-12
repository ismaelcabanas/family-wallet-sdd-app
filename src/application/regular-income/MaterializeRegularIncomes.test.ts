import { describe, expect, it } from "vitest";

import { AccountId } from "@/domain/account/AccountId";
import { Movement } from "@/domain/movement/Movement";
import { MovementId } from "@/domain/movement/MovementId";
import { Money } from "@/domain/movement/Money";
import { RegularIncome } from "@/domain/regular-income/RegularIncome";
import { RegularIncomeId } from "@/domain/regular-income/RegularIncomeId";

import type { RegularIncomeRepository } from "./RegularIncomeRepository";
import { MaterializeRegularIncomes } from "./MaterializeRegularIncomes";

class InMemoryRegularIncomeRepository implements RegularIncomeRepository {
  private readonly configsByAccountId = new Map<number, RegularIncome>();
  private readonly materializedMonths = new Set<string>();
  movements: Movement[] = [];
  private nextConfigId = 1;
  private nextMovementId = 1;

  async findByAccountId(accountId: AccountId): Promise<RegularIncome | null> {
    return this.configsByAccountId.get(accountId as number) ?? null;
  }

  async save(config: RegularIncome): Promise<RegularIncome> {
    let persisted = config;
    if (config.id === null) {
      persisted = RegularIncome.rehydrate({
        id: RegularIncomeId(this.nextConfigId),
        accountId: config.accountId,
        amount: config.amount,
        dayOfMonth: config.dayOfMonth,
        note: config.note,
        active: config.active,
        activatedAtMonth: config.activatedAtMonth,
      });
      this.nextConfigId += 1;
    }
    this.configsByAccountId.set(persisted.accountId as number, persisted);
    return persisted;
  }

  async isMaterialized(regularIncomeId: RegularIncomeId, month: string): Promise<boolean> {
    return this.materializedMonths.has(`${regularIncomeId}:${month}`);
  }

  async registerMaterialization(
    config: RegularIncome,
    month: string,
    movement: Movement,
  ): Promise<boolean> {
    if (config.id === null) {
      throw new Error("registerMaterialization requiere una config persistida");
    }
    const key = `${config.id}:${month}`;
    if (this.materializedMonths.has(key)) {
      return false;
    }
    this.materializedMonths.add(key);
    this.movements.push(
      Movement.recreate(
        MovementId(this.nextMovementId),
        {
          accountId: movement.accountId,
          type: movement.type,
          date: movement.date,
          note: movement.note,
          amount: movement.amount,
          nature: movement.nature,
          tagId: movement.tagId,
        },
        movement.createdAt,
      ),
    );
    this.nextMovementId += 1;
    return true;
  }

  deleteMovement(id: MovementId): void {
    this.movements = this.movements.filter((movement) => movement.id !== id);
  }
}

const ACCOUNT_ID = AccountId(1);
const CURRENT_MONTH = "2026-10";

async function seededRepo(config: RegularIncome | null) {
  const repo = new InMemoryRegularIncomeRepository();
  if (config) {
    await repo.save(config);
  }
  return repo;
}

function activeConfig(overrides: Partial<Parameters<typeof RegularIncome.create>[0]> = {}) {
  return RegularIncome.create({
    accountId: ACCOUNT_ID,
    amount: Money.fromCents(200_000),
    dayOfMonth: 1,
    note: "Ingreso regular de Miembro A",
    active: true,
    activatedAtMonth: CURRENT_MONTH,
    ...overrides,
  });
}

describe("MaterializeRegularIncomes", () => {
  it("la primera consulta del mes en curso materializa el ingreso con dueDateForMonth y sin naturaleza ni etiqueta", async () => {
    const repo = await seededRepo(activeConfig());
    const useCase = new MaterializeRegularIncomes(repo);

    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);

    expect(repo.movements).toHaveLength(1);
    const [movement] = repo.movements;
    expect(movement.accountId).toBe(ACCOUNT_ID);
    expect(movement.type).toBe("income");
    expect(movement.date).toBe("2026-10-01");
    expect(movement.note).toBe("Ingreso regular de Miembro A");
    expect(movement.amount.amountCents).toBe(200_000);
    expect(movement.nature).toBeNull();
    expect(movement.tagId).toBeNull();
    expect(await repo.isMaterialized(RegularIncomeId(1), CURRENT_MONTH)).toBe(true);
  });

  it("la consulta repetida del mismo mes no duplica", async () => {
    const repo = await seededRepo(activeConfig());
    const useCase = new MaterializeRegularIncomes(repo);

    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);
    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);
    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);

    expect(repo.movements).toHaveLength(1);
  });

  it("un mes anterior a la activación nunca se materializa", async () => {
    const repo = await seededRepo(activeConfig({ activatedAtMonth: "2026-08" }));
    const useCase = new MaterializeRegularIncomes(repo);

    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, "2026-07", CURRENT_MONTH);

    expect(repo.movements).toHaveLength(0);
  });

  it("un mes posterior al mes en curso (futuro) nunca se materializa", async () => {
    const repo = await seededRepo(activeConfig());
    const useCase = new MaterializeRegularIncomes(repo);

    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, "2026-11", CURRENT_MONTH);

    expect(repo.movements).toHaveLength(0);
  });

  it("el mes de activación sí se materializa aunque no sea el en curso", async () => {
    const repo = await seededRepo(activeConfig({ activatedAtMonth: "2026-08" }));
    const useCase = new MaterializeRegularIncomes(repo);

    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, "2026-08", CURRENT_MONTH);

    expect(repo.movements).toHaveLength(1);
    expect(repo.movements[0].date).toBe("2026-08-01");
  });

  it("un cambio de importe no toca el mes ya registrado y aplica al pendiente", async () => {
    const repo = await seededRepo(activeConfig({ activatedAtMonth: "2026-08" }));
    const useCase = new MaterializeRegularIncomes(repo);

    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, "2026-09", "2026-12");

    const stored = await repo.findByAccountId(ACCOUNT_ID);
    await repo.save(stored!.update({ amount: Money.fromCents(210_000) }));

    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, "2026-09", "2026-12");
    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, "2026-10", "2026-12");

    expect(repo.movements).toHaveLength(2);
    const september = repo.movements.find((movement) => movement.date.startsWith("2026-09"));
    const october = repo.movements.find((movement) => movement.date.startsWith("2026-10"));
    expect(september?.amount.amountCents).toBe(200_000);
    expect(october?.amount.amountCents).toBe(210_000);
  });

  it("tras borrar el movimiento, el mes no se regenera", async () => {
    const repo = await seededRepo(activeConfig());
    const useCase = new MaterializeRegularIncomes(repo);

    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);
    expect(repo.movements).toHaveLength(1);
    const [movement] = repo.movements;
    repo.deleteMovement(movement.id!);

    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);

    expect(repo.movements).toHaveLength(0);
  });

  it("config inactiva → no-op", async () => {
    const repo = await seededRepo(activeConfig({ active: false }));
    const useCase = new MaterializeRegularIncomes(repo);

    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);

    expect(repo.movements).toHaveLength(0);
  });

  it("sin config → no-op", async () => {
    const repo = await seededRepo(null);
    const useCase = new MaterializeRegularIncomes(repo);

    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, CURRENT_MONTH, CURRENT_MONTH);

    expect(repo.movements).toHaveLength(0);
  });

  it("día 31 se clampa a febrero", async () => {
    const repo = await seededRepo(activeConfig({ dayOfMonth: 31, activatedAtMonth: "2026-01" }));
    const useCase = new MaterializeRegularIncomes(repo);

    await useCase.ensureForAccountAndMonth(ACCOUNT_ID, "2026-02", "2026-12");

    expect(repo.movements).toHaveLength(1);
    expect(repo.movements[0].date).toBe("2026-02-28");
  });
});
