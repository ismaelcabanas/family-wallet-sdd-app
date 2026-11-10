import { describe, expect, it, vi } from "vitest";

import type { AccountDTO, MovementDTO } from "./dto";
import { GetAnnualCategoryExpenseReport } from "./GetAnnualCategoryExpenseReport";
import { Tag } from "@/domain/tag/Tag";
import { TagCategoryId } from "@/domain/tag-category/TagCategoryId";
import { TagCategory } from "@/domain/tag-category/TagCategory";

const movements: MovementDTO[] = [
  {
    id: 1,
    accountId: 1,
    type: "expense",
    date: "2026-01-05",
    note: "Compra semanal",
    amountCents: 30_000,
    nature: "shared",
    tag: { id: 11, name: "Alimentación", slug: "alimentacion" },
  },
  {
    id: 2,
    accountId: 3,
    type: "expense",
    date: "2026-01-20",
    note: "Compra común",
    amountCents: 12_000,
    nature: "shared",
    tag: { id: 12, name: "Supermercado", slug: "supermercado" },
  },
  {
    id: 3,
    accountId: 1,
    type: "expense",
    date: "2026-02-08",
    note: "Aportación",
    amountCents: 96_000,
    nature: "personal",
    tag: { id: 13, name: "Aportación Común", slug: "aportacion-comun" },
  },
  {
    id: 4,
    accountId: 2,
    type: "expense",
    date: "2026-02-10",
    note: "Gasolina",
    amountCents: 6_000,
    nature: "personal",
    tag: { id: 14, name: "Coche", slug: "coche" },
  },
  {
    id: 5,
    accountId: 1,
    type: "income",
    date: "2026-01-05",
    note: "Nómina",
    amountCents: 210_000,
    nature: null,
    tag: null,
  },
];

const tags = [
  Tag.rehydrate(11, "Alimentación", "alimentacion", "active", TagCategoryId(1)),
  Tag.rehydrate(12, "Supermercado", "supermercado", "active", TagCategoryId(1)),
  Tag.rehydrate(13, "Aportación Común", "aportacion-comun", "active", TagCategoryId(1)),
  Tag.rehydrate(14, "Coche", "coche", "inactive", TagCategoryId(2)),
];

const categories = [
  TagCategory.rehydrate(2, "Transporte", "transporte"),
  TagCategory.rehydrate(1, "General", "general"),
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
    listByMonth: vi.fn(),
    listByYear: vi.fn().mockResolvedValue(rows),
    findById: vi.fn().mockResolvedValue(null),
    update: vi.fn(),
    delete: vi.fn(),
    sumSharedExpenseCents: vi.fn(),
    retagMovements: vi.fn(),
  };
}

function tagRepositoryWith(rows: Tag[]) {
  return {
    findAllActive: vi.fn(),
    findByIds: vi.fn(),
    findBySlug: vi.fn(),
    findByName: vi.fn(),
    save: vi.fn(),
    findById: vi.fn(),
    findAll: vi.fn().mockResolvedValue(rows),
    update: vi.fn(),
    mergeInto: vi.fn(),
  };
}

function categoryRepositoryWith(rows: TagCategory[]) {
  return {
    findAll: vi.fn().mockResolvedValue(rows),
    findById: vi.fn(),
    findBySlug: vi.fn(),
    findByName: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    countTags: vi.fn(),
  };
}

function accountRepositoryWith(rows: AccountDTO[]) {
  return {
    findAll: vi.fn().mockResolvedValue(rows),
    findById: vi.fn().mockResolvedValue(null),
    findByName: vi.fn(),
    update: vi.fn(),
  };
}

describe("GetAnnualCategoryExpenseReport", () => {
  it("resuelve el join tag→categoría en memoria y devuelve el DTO espejo del agregado", async () => {
    const movementRepository = movementRepositoryWith(movements);
    const useCase = new GetAnnualCategoryExpenseReport(
      movementRepository,
      tagRepositoryWith(tags),
      categoryRepositoryWith(categories),
      accountRepositoryWith(accounts),
    );

    const report = await useCase.execute("2026");

    expect(movementRepository.listByYear).toHaveBeenCalledExactlyOnceWith("2026");

    expect(report.year).toBe("2026");
    expect(report.rows.map((row) => row.categoryName)).toEqual(["General", "Transporte"]);

    const general = report.rows[0];
    expect(general.categoryId).toBe(1);
    expect(general.monthlyAmountCents).toHaveLength(12);
    expect(general.monthlyAmountCents[0]).toBe(42_000);
    expect(general.monthlyAmountCents[1]).toBe(0);
    expect(general.annualTotalCents).toBe(42_000);
    expect(general.annualAverageCents).toBe(Math.round(42_000 / 12));

    const transporte = report.rows[1];
    expect(transporte.monthlyAmountCents[1]).toBe(6_000);
    expect(transporte.annualTotalCents).toBe(6_000);
    expect(transporte.annualAverageCents).toBe(Math.round(6_000 / 12));

    expect(report.monthlyTotalCents[0]).toBe(42_000);
    expect(report.monthlyTotalCents[1]).toBe(6_000);
    expect(report.monthlyTotalAverageCents).toBe(Math.round(48_000 / 12));

    expect(report.monthlyPersonalTotalCents[0]).toBe(0);
    expect(report.monthlyPersonalTotalCents[1]).toBe(6_000);
    expect(report.personalTotalAverageCents).toBe(Math.round(6_000 / 12));
  });

  it("rechaza un año con formato inválido con error de dominio sin consultar los puertos", async () => {
    const movementRepository = movementRepositoryWith([]);
    const tagRepository = tagRepositoryWith([]);
    const categoryRepository = categoryRepositoryWith([]);
    const accountRepository = accountRepositoryWith([]);
    const useCase = new GetAnnualCategoryExpenseReport(
      movementRepository,
      tagRepository,
      categoryRepository,
      accountRepository,
    );

    await expect(useCase.execute("26")).rejects.toThrowError(/año/i);
    await expect(useCase.execute("2026-01")).rejects.toThrowError(/año/i);
    await expect(useCase.execute("abcd")).rejects.toThrowError(/año/i);
    expect(movementRepository.listByYear).not.toHaveBeenCalled();
    expect(tagRepository.findAll).not.toHaveBeenCalled();
    expect(categoryRepository.findAll).not.toHaveBeenCalled();
    expect(accountRepository.findAll).not.toHaveBeenCalled();
  });

  it("devuelve la estructura completa con todas las categorías a cero para un año vacío", async () => {
    const useCase = new GetAnnualCategoryExpenseReport(
      movementRepositoryWith([]),
      tagRepositoryWith(tags),
      categoryRepositoryWith(categories),
      accountRepositoryWith(accounts),
    );

    const report = await useCase.execute("2024");

    expect(report.rows.map((row) => row.categoryName)).toEqual(["General", "Transporte"]);
    for (const row of report.rows) {
      expect(row.monthlyAmountCents).toEqual(Array<number>(12).fill(0));
      expect(row.annualTotalCents).toBe(0);
      expect(row.annualAverageCents).toBe(0);
    }
    expect(report.monthlyTotalCents).toEqual(Array<number>(12).fill(0));
    expect(report.monthlyPersonalTotalCents).toEqual(Array<number>(12).fill(0));
    expect(report.monthlyTotalAverageCents).toBe(0);
    expect(report.personalTotalAverageCents).toBe(0);
  });
});
