import { describe, expect, it, vi } from "vitest";

import { Member } from "@/domain/member/Member";

import type { AccountDTO, MovementDTO } from "./dto";
import { GetAnnualIncomeStatement } from "./GetAnnualIncomeStatement";

const movements: MovementDTO[] = [
  {
    id: 1,
    accountId: 1,
    type: "income",
    date: "2026-01-05",
    concept: "Nómina",
    description: null,
    amountCents: 210_000,
    nature: null,
    tags: [],
  },
  {
    id: 2,
    accountId: 2,
    type: "income",
    date: "2026-01-05",
    concept: "Nómina",
    description: null,
    amountCents: 160_000,
    nature: null,
    tags: [],
  },
  {
    id: 3,
    accountId: 3,
    type: "income",
    date: "2026-01-03",
    concept: "Aportaciones",
    description: null,
    amountCents: 192_000,
    nature: null,
    tags: [],
  },
  {
    id: 4,
    accountId: 3,
    type: "expense",
    date: "2026-01-05",
    concept: "Hipoteca",
    description: null,
    amountCents: 85_000,
    nature: "shared",
    tags: [
      { id: 1, name: "Vivienda", slug: "vivienda" },
      { id: 2, name: "Hipoteca", slug: "hipoteca" },
    ],
  },
  {
    id: 5,
    accountId: 1,
    type: "expense",
    date: "2026-01-10",
    concept: "Gasolina",
    description: null,
    amountCents: 6_000,
    nature: "personal",
    tags: [{ id: 3, name: "Coche", slug: "coche" }],
  },
  {
    id: 6,
    accountId: 2,
    type: "expense",
    date: "2026-07-12",
    concept: "Compra semanal",
    description: null,
    amountCents: 306_000,
    nature: "shared",
    tags: [{ id: 4, name: "Alimentación", slug: "alimentacion" }],
  },
  {
    id: 7,
    accountId: 2,
    type: "income",
    date: "2026-07-05",
    concept: "Nómina",
    description: null,
    amountCents: 160_000,
    nature: null,
    tags: [],
  },
];

const accounts: AccountDTO[] = [
  { id: 1, name: "Cuenta de Miembro A", type: "personal", memberId: 10, memberName: "Miembro A" },
  { id: 2, name: "Cuenta de Miembro B", type: "personal", memberId: 20, memberName: "Miembro B" },
  { id: 3, name: "Cuenta común", type: "shared", memberId: null, memberName: null },
];

const members = [Member.rehydrate(10, "Miembro A"), Member.rehydrate(20, "Miembro B")];

function movementRepositoryWith(rows: MovementDTO[]) {
  return {
    create: vi.fn(),
    listByMonthAndAccount: vi.fn(),
    listByMonth: vi.fn(),
    listByYear: vi.fn().mockResolvedValue(rows),
    findById: vi.fn().mockResolvedValue(null),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

function accountRepositoryWith(rows: AccountDTO[]) {
  return {
    findAll: vi.fn().mockResolvedValue(rows),
    findById: vi.fn().mockResolvedValue(null),
    getBalance: vi.fn(),
  };
}

function memberRepositoryWith(rows: Member[]) {
  return {
    findAll: vi.fn().mockResolvedValue(rows),
  };
}

describe("GetAnnualIncomeStatement", () => {
  it("lee el año, las cuentas y los miembros vía puertos y devuelve la cuenta anual", async () => {
    const movementRepository = movementRepositoryWith(movements);
    const accountRepository = accountRepositoryWith(accounts);
    const memberRepository = memberRepositoryWith(members);
    const useCase = new GetAnnualIncomeStatement(
      movementRepository,
      accountRepository,
      memberRepository,
    );

    const statement = await useCase.execute("2026");

    expect(movementRepository.listByYear).toHaveBeenCalledExactlyOnceWith("2026");
    expect(accountRepository.findAll).toHaveBeenCalledExactlyOnceWith();
    expect(memberRepository.findAll).toHaveBeenCalledExactlyOnceWith();

    expect(statement.monthlySummaries).toHaveLength(12);
    expect(statement.monthlySummaries[0].incomeTotalCents).toBe(562_000);
    expect(statement.monthlySummaries[0].expenseTotalCents).toBe(91_000);
    expect(statement.monthlySummaries[6].incomeTotalCents).toBe(160_000);
    expect(statement.monthlySummaries[6].expenseTotalCents).toBe(306_000);
    expect(statement.monthlySummaries[1].incomeTotalCents).toBe(0);

    expect(statement.memberIncomeRows.map((row) => [row.memberId, row.memberName])).toEqual([
      [10, "Miembro A"],
      [20, "Miembro B"],
      [null, null],
    ]);
    expect(statement.memberIncomeRows[0].monthlyIncomeCents[0]).toBe(210_000);
    expect(statement.memberIncomeRows[1].monthlyIncomeCents[0]).toBe(160_000);
    expect(statement.memberIncomeRows[1].monthlyIncomeCents[6]).toBe(160_000);
    expect(statement.memberIncomeRows[2].monthlyIncomeCents[0]).toBe(192_000);

    expect(statement.totalIncomeRow.totalCents).toBe(722_000);
    expect(statement.totalIncomeRow.averageCents).toBe(Math.round(722_000 / 12));
    expect(statement.expenseRealRow.totalCents).toBe(397_000);
    expect(statement.noPersonalExpenseRow.totalCents).toBe(391_000);
    expect(statement.balanceRow.totalCents).toBe(325_000);
    expect(statement.balanceRow.monthlyCents[0]).toBe(471_000);
    expect(statement.balanceRow.monthlyCents[6]).toBe(-146_000);
    expect(statement.accumulatedBalanceRow.monthlyCents[0]).toBe(471_000);
    expect(statement.accumulatedBalanceRow.monthlyCents[6]).toBe(325_000);
    expect(statement.accumulatedBalanceRow.totalCents).toBe(325_000);

    expect(statement.tagRows.map((row) => [row.tagName, row.totalCents])).toEqual([
      ["Alimentación", 306_000],
      ["Hipoteca", 85_000],
      ["Vivienda", 85_000],
      ["Coche", 6_000],
    ]);
  });

  it("coincide con el cálculo directo del VO sobre los mismos datos", async () => {
    const useCase = new GetAnnualIncomeStatement(
      movementRepositoryWith(movements),
      accountRepositoryWith(accounts),
      memberRepositoryWith(members),
    );

    const statement = await useCase.execute("2026");

    expect(statement.totalIncomeRow.totalCents).toBe(
      statement.memberIncomeRows.reduce((sum, row) => sum + row.totalCents, 0),
    );
    expect(statement.expenseRealRow.totalCents).toBe(
      statement.monthlySummaries.reduce((sum, summary) => sum + summary.expenseTotalCents, 0),
    );
    expect(statement.accumulatedBalanceRow.totalCents).toBe(statement.balanceRow.totalCents);
  });

  it("rechaza un año con formato inválido sin consultar los puertos", async () => {
    const movementRepository = movementRepositoryWith([]);
    const accountRepository = accountRepositoryWith([]);
    const memberRepository = memberRepositoryWith([]);
    const useCase = new GetAnnualIncomeStatement(
      movementRepository,
      accountRepository,
      memberRepository,
    );

    await expect(useCase.execute("26")).rejects.toThrowError(/año/i);
    await expect(useCase.execute("2026-01")).rejects.toThrowError(/año/i);
    await expect(useCase.execute("abcd")).rejects.toThrowError(/año/i);
    expect(movementRepository.listByYear).not.toHaveBeenCalled();
    expect(accountRepository.findAll).not.toHaveBeenCalled();
    expect(memberRepository.findAll).not.toHaveBeenCalled();
  });

  it("devuelve la estructura completa a ceros para un año sin movimientos", async () => {
    const useCase = new GetAnnualIncomeStatement(
      movementRepositoryWith([]),
      accountRepositoryWith(accounts),
      memberRepositoryWith(members),
    );

    const statement = await useCase.execute("2028");

    expect(statement.monthlySummaries).toHaveLength(12);
    expect(statement.totalIncomeRow.monthlyCents).toEqual(Array(12).fill(0));
    expect(statement.expenseRealRow.monthlyCents).toEqual(Array(12).fill(0));
    expect(statement.noPersonalExpenseRow.monthlyCents).toEqual(Array(12).fill(0));
    expect(statement.balanceRow.monthlyCents).toEqual(Array(12).fill(0));
    expect(statement.accumulatedBalanceRow.monthlyCents).toEqual(Array(12).fill(0));
    expect(statement.tagRows).toEqual([]);
    expect(statement.memberIncomeRows.map((row) => row.memberId)).toEqual([10, 20, null]);
  });
});
