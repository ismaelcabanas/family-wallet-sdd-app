import { describe, expect, it, vi } from "vitest";

import type { MovementDTO } from "./dto";
import { GetMonthlyClosure } from "./GetMonthlyClosure";

const movements: MovementDTO[] = [
  {
    id: 1,
    accountId: 2,
    type: "income",
    date: "2026-09-01",
    concept: "Aportación",
    description: null,
    amountCents: 192_000,
    nature: null,
    tags: [{ id: 9, name: "Alimentación", slug: "alimentacion" }],
  },
  {
    id: 2,
    accountId: 2,
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
    id: 3,
    accountId: 2,
    type: "expense",
    date: "2026-09-10",
    concept: "Luz",
    description: null,
    amountCents: 12_050,
    nature: "shared",
    tags: [{ id: 3, name: "Hogar", slug: "hogar" }],
  },
];

function repositoryWith(rows: MovementDTO[]) {
  return {
    create: vi.fn(),
    listByMonthAndAccount: vi.fn().mockResolvedValue(rows),
  };
}

describe("GetMonthlyClosure", () => {
  it("obtiene el mes del repositorio y devuelve el cierre calculado", async () => {
    const repository = repositoryWith(movements);
    const useCase = new GetMonthlyClosure(repository);

    const closure = await useCase.execute(2, "2026-09");

    expect(repository.listByMonthAndAccount).toHaveBeenCalledExactlyOnceWith(2, "2026-09");
    expect(closure.incomeTotalCents).toBe(192_000);
    expect(closure.expenseTotalCents).toBe(97_050);
    expect(closure.sharedExpenseCents).toBe(97_050);
    expect(closure.personalExpenseCents).toBe(0);
    expect(closure.monthBalanceCents).toBe(94_950);
    expect(closure.tagBreakdown).toEqual([
      { tagId: 2, tagName: "Hipoteca", amountCents: 85_000 },
      { tagId: 1, tagName: "Vivienda", amountCents: 85_000 },
      { tagId: 3, tagName: "Hogar", amountCents: 12_050 },
    ]);
  });

  it("rechaza un mes con formato inválido sin consultar el repositorio", async () => {
    const repository = repositoryWith([]);
    const useCase = new GetMonthlyClosure(repository);

    await expect(useCase.execute(2, "2026-13")).rejects.toThrowError(/mes/i);
    await expect(useCase.execute(2, "sep-2026")).rejects.toThrowError(/mes/i);
    expect(repository.listByMonthAndAccount).not.toHaveBeenCalled();
  });

  it("devuelve el cierre a cero y desglose vacío para un mes sin movimientos", async () => {
    const useCase = new GetMonthlyClosure(repositoryWith([]));

    const closure = await useCase.execute(2, "2026-08");

    expect(closure.incomeTotalCents).toBe(0);
    expect(closure.expenseTotalCents).toBe(0);
    expect(closure.sharedExpenseCents).toBe(0);
    expect(closure.personalExpenseCents).toBe(0);
    expect(closure.monthBalanceCents).toBe(0);
    expect(closure.tagBreakdown).toEqual([]);
  });
});
