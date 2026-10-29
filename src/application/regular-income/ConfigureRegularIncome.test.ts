import { describe, expect, it } from "vitest";

import type { AccountRepository } from "../account/AccountRepository";
import type { AccountDTO } from "../movement/dto";
import type { RegularIncomeRepository } from "./RegularIncomeRepository";
import { ConfigureRegularIncome } from "./ConfigureRegularIncome";
import { AccountId } from "@/domain/account/AccountId";
import { Account } from "@/domain/account/Account";
import { AccountNotFoundError } from "@/domain/account/AccountErrors";
import { InvalidMoneyError } from "@/domain/movement/MovementErrors";
import { RegularIncome } from "@/domain/regular-income/RegularIncome";
import { RegularIncomeId } from "@/domain/regular-income/RegularIncomeId";
import { SharedAccountIncomeError } from "@/domain/regular-income/RegularIncomeErrors";

class InMemoryRegularIncomeRepository implements RegularIncomeRepository {
  private readonly configsByAccountId = new Map<number, RegularIncome>();
  private nextId = 1;

  async findByAccountId(accountId: AccountId): Promise<RegularIncome | null> {
    return this.configsByAccountId.get(accountId as number) ?? null;
  }

  async save(config: RegularIncome): Promise<RegularIncome> {
    let persisted = config;
    if (config.id === null) {
      persisted = RegularIncome.rehydrate({
        id: RegularIncomeId(this.nextId),
        accountId: config.accountId,
        amount: config.amount,
        dayOfMonth: config.dayOfMonth,
        note: config.note,
        active: config.active,
        activatedAtMonth: config.activatedAtMonth,
      });
      this.nextId += 1;
    }
    this.configsByAccountId.set(persisted.accountId as number, persisted);
    return persisted;
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

  async findByName(): Promise<Account | null> {
    return null;
  }

  async update(account: Account): Promise<Account> {
    return account;
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

function buildUseCase(rows: AccountDTO[] = [MEMBER_A_ACCOUNT, SHARED_ACCOUNT]) {
  const regularIncomes = new InMemoryRegularIncomeRepository();
  const useCase = new ConfigureRegularIncome(
    regularIncomes,
    new InMemoryAccountRepository(rows),
  );
  return { regularIncomes, useCase };
}

const CURRENT_MONTH = "2026-10";

describe("ConfigureRegularIncome", () => {
  it("crea la config con defaults: día 1, nota del miembro, activación al mes en curso y activa", async () => {
    const { useCase } = buildUseCase();

    const dto = await useCase.execute({
      accountId: 1,
      amountCents: 200_000,
      dayOfMonth: 1,
      note: null,
      currentMonth: CURRENT_MONTH,
    });

    expect(dto).toEqual({
      accountId: 1,
      amountCents: 200_000,
      dayOfMonth: 1,
      note: "Ingreso regular de Miembro A",
      active: true,
      activatedAtMonth: CURRENT_MONTH,
    });
  });

  it("conserva la nota explícita (no vacía tras trim)", async () => {
    const { useCase } = buildUseCase();

    const dto = await useCase.execute({
      accountId: 1,
      amountCents: 200_000,
      dayOfMonth: 15,
      note: "  Nómina  ",
      currentMonth: CURRENT_MONTH,
    });

    expect(dto.note).toBe("Nómina");
    expect(dto.dayOfMonth).toBe(15);
  });

  it("la nota de solo espacios cae en el default del miembro", async () => {
    const { useCase } = buildUseCase();

    const dto = await useCase.execute({
      accountId: 1,
      amountCents: 200_000,
      dayOfMonth: 1,
      note: "   ",
      currentMonth: CURRENT_MONTH,
    });

    expect(dto.note).toBe("Ingreso regular de Miembro A");
  });

  it("edita una config existente sin resetear activatedAtMonth", async () => {
    const { regularIncomes, useCase } = buildUseCase();

    await useCase.execute({
      accountId: 1,
      amountCents: 200_000,
      dayOfMonth: 1,
      note: null,
      currentMonth: "2026-08",
    });

    const dto = await useCase.execute({
      accountId: 1,
      amountCents: 210_000,
      dayOfMonth: 5,
      note: "Nómina nueva",
      currentMonth: CURRENT_MONTH,
    });

    expect(dto.amountCents).toBe(210_000);
    expect(dto.dayOfMonth).toBe(5);
    expect(dto.active).toBe(true);
    expect(dto.activatedAtMonth).toBe("2026-08");

    const stored = await regularIncomes.findByAccountId(AccountId(1));
    expect(stored?.activatedAtMonth).toBe("2026-08");
  });

  it("reactivar una config inactiva resetea activatedAtMonth al mes en curso", async () => {
    const { regularIncomes, useCase } = buildUseCase();

    const created = await useCase.execute({
      accountId: 1,
      amountCents: 200_000,
      dayOfMonth: 1,
      note: null,
      currentMonth: "2026-06",
    });
    expect(created.active).toBe(true);

    const storedBefore = await regularIncomes.findByAccountId(AccountId(1));
    const deactivated = storedBefore!.deactivate();
    await regularIncomes.save(deactivated);

    const reactivated = await useCase.execute({
      accountId: 1,
      amountCents: 200_000,
      dayOfMonth: 1,
      note: null,
      currentMonth: CURRENT_MONTH,
    });

    expect(reactivated.active).toBe(true);
    expect(reactivated.activatedAtMonth).toBe(CURRENT_MONTH);
  });

  it("rechaza la cuenta común con SharedAccountIncomeError", async () => {
    const { useCase } = buildUseCase();

    await expect(
      useCase.execute({
        accountId: 3,
        amountCents: 200_000,
        dayOfMonth: 1,
        note: null,
        currentMonth: CURRENT_MONTH,
      }),
    ).rejects.toThrowError(SharedAccountIncomeError);
  });

  it("rechaza una cuenta inexistente", async () => {
    const { useCase } = buildUseCase();

    await expect(
      useCase.execute({
        accountId: 99,
        amountCents: 200_000,
        dayOfMonth: 1,
        note: null,
        currentMonth: CURRENT_MONTH,
      }),
    ).rejects.toThrowError(AccountNotFoundError);
  });

  it("propaga el error de Money ante un importe inválido", async () => {
    const { useCase } = buildUseCase();

    await expect(
      useCase.execute({
        accountId: 1,
        amountCents: 0,
        dayOfMonth: 1,
        note: null,
        currentMonth: CURRENT_MONTH,
      }),
    ).rejects.toThrowError(InvalidMoneyError);
  });
});
