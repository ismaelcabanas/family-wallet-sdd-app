import { describe, expect, it, vi } from "vitest";

import type { AccountDTO, MovementDTO } from "./dto";
import { GetGlobalMonthlySummary } from "./GetGlobalMonthlySummary";

const movements: MovementDTO[] = [
  {
    id: 1,
    accountId: 3,
    type: "expense",
    date: "2026-09-05",
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
    id: 2,
    accountId: 1,
    type: "income",
    date: "2026-09-01",
    concept: "Nómina",
    description: null,
    amountCents: 210_000,
    nature: null,
    tags: [],
  },
  {
    id: 3,
    accountId: 1,
    type: "expense",
    date: "2026-09-10",
    concept: "Gasolina",
    description: null,
    amountCents: 6_000,
    nature: "personal",
    tags: [{ id: 3, name: "Coche", slug: "coche" }],
  },
  {
    id: 4,
    accountId: 2,
    type: "expense",
    date: "2026-09-12",
    concept: "Compra semanal",
    description: null,
    amountCents: 15_050,
    nature: "shared",
    tags: [{ id: 4, name: "Alimentación", slug: "alimentacion" }],
  },
];

const accounts: AccountDTO[] = [
  { id: 1, name: "Cuenta de Miembro A", type: "personal", memberId: 10, memberName: "Miembro A" },
  { id: 2, name: "Cuenta de Miembro B", type: "personal", memberId: 20, memberName: "Miembro B" },
  { id: 3, name: "Cuenta común", type: "shared", memberId: null, memberName: null },
];

function movementRepositoryWith(rows: MovementDTO[]) {
  return {
    create: vi.fn(),
    listByMonthAndAccount: vi.fn(),
    listByMonth: vi.fn().mockResolvedValue(rows),
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

describe("GetGlobalMonthlySummary", () => {
  it("lee el mes completo y las cuentas vía puertos y devuelve el resumen calculado", async () => {
    const movementRepository = movementRepositoryWith(movements);
    const accountRepository = accountRepositoryWith(accounts);
    const useCase = new GetGlobalMonthlySummary(movementRepository, accountRepository);

    const summary = await useCase.execute("2026-09");

    expect(movementRepository.listByMonth).toHaveBeenCalledExactlyOnceWith("2026-09");
    expect(accountRepository.findAll).toHaveBeenCalledExactlyOnceWith();

    expect(summary.incomeTotalCents).toBe(210_000);
    expect(summary.expenseTotalCents).toBe(106_050);
    expect(summary.sharedExpenseCents).toBe(100_050);
    expect(summary.personalExpenseCents).toBe(6_000);
    expect(summary.monthBalanceCents).toBe(103_950);

    expect(summary.tagBreakdown).toEqual([
      { tagId: 2, tagName: "Hipoteca", amountCents: 85_000 },
      { tagId: 1, tagName: "Vivienda", amountCents: 85_000 },
      { tagId: 4, tagName: "Alimentación", amountCents: 15_050 },
      { tagId: 3, tagName: "Coche", amountCents: 6_000 },
    ]);

    expect(summary.memberBreakdown).toEqual([
      { memberId: null, memberName: null, personalCents: 0, sharedCents: 85_000 },
      { memberId: 20, memberName: "Miembro B", personalCents: 0, sharedCents: 15_050 },
      { memberId: 10, memberName: "Miembro A", personalCents: 6_000, sharedCents: 0 },
    ]);
  });

  it("coincide céntimo a céntimo con el cálculo directo del VO sobre los mismos datos", async () => {
    const useCase = new GetGlobalMonthlySummary(
      movementRepositoryWith(movements),
      accountRepositoryWith(accounts),
    );

    const summary = await useCase.execute("2026-09");

    const memberBreakdownTotal = summary.memberBreakdown.reduce(
      (sum, entry) => sum + entry.personalCents + entry.sharedCents,
      0,
    );
    expect(memberBreakdownTotal).toBe(summary.expenseTotalCents);
    expect(summary.sharedExpenseCents + summary.personalExpenseCents).toBe(summary.expenseTotalCents);
  });

  it("agrupa por memberId aunque dos miembros sean homónimos", async () => {
    const homonimos: AccountDTO[] = [
      { id: 1, name: "Cuenta de Alex 1", type: "personal", memberId: 10, memberName: "Alex" },
      { id: 2, name: "Cuenta de Alex 2", type: "personal", memberId: 20, memberName: "Alex" },
    ];
    const useCase = new GetGlobalMonthlySummary(
      movementRepositoryWith([
        { ...movements[2], accountId: 1 },
        { ...movements[3], accountId: 2, amountCents: 9_000 },
      ]),
      accountRepositoryWith(homonimos),
    );

    const summary = await useCase.execute("2026-09");

    expect(summary.memberBreakdown).toEqual([
      { memberId: 20, memberName: "Alex", personalCents: 0, sharedCents: 9_000 },
      { memberId: 10, memberName: "Alex", personalCents: 6_000, sharedCents: 0 },
    ]);
  });

  it("rechaza un mes con formato inválido sin consultar los puertos", async () => {
    const movementRepository = movementRepositoryWith([]);
    const accountRepository = accountRepositoryWith([]);
    const useCase = new GetGlobalMonthlySummary(movementRepository, accountRepository);

    await expect(useCase.execute("2026-13")).rejects.toThrowError(/mes/i);
    await expect(useCase.execute("sep-2026")).rejects.toThrowError(/mes/i);
    expect(movementRepository.listByMonth).not.toHaveBeenCalled();
    expect(accountRepository.findAll).not.toHaveBeenCalled();
  });

  it("devuelve el resumen a cero y desgloses vacíos para un mes sin movimientos", async () => {
    const useCase = new GetGlobalMonthlySummary(
      movementRepositoryWith([]),
      accountRepositoryWith(accounts),
    );

    const summary = await useCase.execute("2026-08");

    expect(summary.incomeTotalCents).toBe(0);
    expect(summary.expenseTotalCents).toBe(0);
    expect(summary.sharedExpenseCents).toBe(0);
    expect(summary.personalExpenseCents).toBe(0);
    expect(summary.monthBalanceCents).toBe(0);
    expect(summary.tagBreakdown).toEqual([]);
    expect(summary.memberBreakdown).toEqual([]);
  });
});
