import type { AccountRepository } from "@/application/account/AccountRepository";
import type { AccountDTO } from "@/application/movement/dto";
import { AccountNotFoundError } from "@/domain/account/AccountErrors";
import { Tag } from "@/domain/tag/Tag";
import { InMemoryCatalogTagRepository } from "@/application/tag/InMemoryCatalogTagRepository";
import { TagCategory } from "@/domain/tag-category/TagCategory";
import { TagCategoryId } from "@/domain/tag-category/TagCategoryId";
import { InMemoryCategoryRepository } from "@/application/tag-category/InMemoryCategoryRepository";
import { CategoryNotFoundError } from "@/domain/tag-category/TagCategoryErrors";
import { describe, expect, it } from "vitest";

import { BuildSheetImportPreview } from "./BuildSheetImportPreview";
import type { SheetCellsRow } from "./sheet-import-plan";

class InMemoryAccountRepository implements AccountRepository {
  constructor(readonly dtos: AccountDTO[]) {}

  async findAll(): Promise<AccountDTO[]> {
    return [...this.dtos];
  }

  async findById(): Promise<null> {
    return null;
  }

  async findByName(): Promise<null> {
    return null;
  }

  async update(): Promise<never> {
    throw new Error("no esperado en este test");
  }
}

function row13(line: number, overrides: Partial<Record<0 | 1 | 2 | 3 | 4 | 5, string>> = {}): SheetCellsRow {
  const cells = ["", "", "", "", "", "", "", "", "", "", "", "", ""];
  for (const [index, value] of Object.entries(overrides)) {
    cells[Number(index)] = value;
  }
  return { line, cells };
}

const ACCOUNTS: AccountDTO[] = [
  {
    id: 1,
    name: "Cuenta de Miembro A",
    type: "personal",
    memberId: 1,
    memberName: "Miembro A",
  },
  { id: 3, name: "Cuenta común", type: "shared", memberId: null, memberName: null },
];

const TAGS = [
  Tag.rehydrate(7, "Ocio", "ocio", "active", TagCategoryId(1)),
  Tag.rehydrate(8, "Salud", "salud", "inactive", TagCategoryId(1)),
];

function buildUseCase(overrides?: {
  accounts?: AccountDTO[];
  tags?: Tag[];
  categories?: InMemoryCategoryRepository;
}) {
  const accounts = new InMemoryAccountRepository(overrides?.accounts ?? ACCOUNTS);
  const tags = new InMemoryCatalogTagRepository(overrides?.tags ?? TAGS);
  const categories =
    overrides?.categories ??
    new InMemoryCategoryRepository([TagCategory.rehydrate(1, "General", "general")]);
  return {
    accounts,
    tags,
    categories,
    useCase: new BuildSheetImportPreview(accounts, tags, categories),
  };
}

describe("BuildSheetImportPreview", () => {
  it("devuelve la previsualización completa: nombre mostrado de la cuenta, filas en orden, totales y etiquetas nuevas", async () => {
    const { useCase } = buildUseCase();

    const preview = await useCase.execute({
      accountId: 1,
      month: "2026-01",
      rows: [
        row13(2, { 1: "Carrera", 2: "OPie Randobike", 3: "Gasto", 4: "7.85", 5: "Ocio" }),
        row13(3, { 1: "Aportación Común", 3: "Gasto Fijo", 4: "1920", 5: "Hogar" }),
        row13(4, { 1: "Roto", 3: "Gasto", 4: "abc", 5: "Ocio" }),
        row13(5, { 1: "Pienso", 3: "Gasto", 4: "18.65", 5: "Mascotas" }),
        row13(6, { 1: "Arena", 3: "Gasto", 4: "9", 5: "MASCOTAS" }),
      ],
    });

    expect(preview.accountName).toBe("Cuenta de Miembro A");
    expect(preview.month).toBe("2026-01");
    expect(preview.rows).toHaveLength(5);
    expect(preview.rows[0]).toEqual({
      line: 2,
      status: "ok",
      movement: {
        date: "2026-01-01",
        note: "Carrera — OPie Randobike",
        amountCents: 785,
        type: "expense",
        nature: "personal",
        tagName: "Ocio",
        createsTag: false,
      },
    });
    expect(preview.rows[1]).toEqual({
      line: 3,
      status: "ignored",
      reason: "fila de configuración de la hoja",
    });
    expect(preview.rows[2].status).toBe("error");
    if (preview.rows[2].status === "error") {
      expect(preview.rows[2].reason).toContain("formato válido");
    }
    expect(preview.totals).toEqual({
      movements: 3,
      personalExpenseCents: 3550,
      sharedExpenseCents: 0,
      incomeCents: 0,
      ignored: 1,
      errors: 1,
    });
    expect(preview.tagsToCreate).toEqual(["Mascotas"]);
  });

  it("cuenta inexistente → AccountNotFoundError", async () => {
    const { useCase } = buildUseCase();

    await expect(
      useCase.execute({
        accountId: 99,
        month: "2026-01",
        rows: [row13(2, { 1: "X", 3: "Ingreso", 4: "1" })],
      }),
    ).rejects.toThrowError(AccountNotFoundError);
  });

  it("sin categoría genérica → CategoryNotFoundError", async () => {
    const { useCase } = buildUseCase({ categories: new InMemoryCategoryRepository([]) });

    await expect(
      useCase.execute({
        accountId: 1,
        month: "2026-01",
        rows: [row13(2, { 1: "X", 3: "Ingreso", 4: "1" })],
      }),
    ).rejects.toThrowError(CategoryNotFoundError);
  });

  it("nunca escribe nada: el catálogo queda intacto tras previsualizar (FR-005)", async () => {
    const { useCase, tags } = buildUseCase();

    await useCase.execute({
      accountId: 3,
      month: "2026-01",
      rows: [row13(2, { 1: "Pienso", 3: "Gasto", 4: "18.65", 5: "Mascotas" })],
    });

    expect(tags.stored).toHaveLength(2);
    expect(tags.stored.map((tag) => tag.name)).toEqual(["Ocio", "Salud"]);
  });
});
