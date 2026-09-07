import { describe, expect, it, vi } from "vitest";

import type { MovementDTO } from "./dto";
import { ListMovements } from "./ListMovements";

const movements: MovementDTO[] = [
  {
    id: 2,
    accountId: 1,
    type: "expense",
    date: "2026-09-03",
    concept: "Hipoteca",
    description: null,
    amountCents: 85_000,
    nature: "shared",
    tags: [{ id: 2, name: "Vivienda", slug: "vivienda" }],
  },
];

describe("ListMovements", () => {
  it("delega en el repositorio con la cuenta y el mes solicitados", async () => {
    const repository = {
      create: vi.fn(),
      listByMonthAndAccount: vi.fn().mockResolvedValue(movements),
    };
    const useCase = new ListMovements(repository);

    const result = await useCase.execute(1, "2026-09");

    expect(repository.listByMonthAndAccount).toHaveBeenCalledExactlyOnceWith(1, "2026-09");
    expect(result).toBe(movements);
  });

  it("rechaza un mes con formato inválido", async () => {
    const repository = { create: vi.fn(), listByMonthAndAccount: vi.fn() };
    const useCase = new ListMovements(repository);

    await expect(useCase.execute(1, "2026-13")).rejects.toThrowError(/mes/i);
    await expect(useCase.execute(1, "sep-2026")).rejects.toThrowError(/mes/i);
  });
});
