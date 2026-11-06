import type { AccountRepository } from "@/application/account/AccountRepository";
import type { AccountDTO } from "@/application/movement/dto";
import { Tag } from "@/domain/tag/Tag";
import { InMemoryCatalogTagRepository } from "@/application/tag/InMemoryCatalogTagRepository";
import { TagCategory } from "@/domain/tag-category/TagCategory";
import { TagCategoryId } from "@/domain/tag-category/TagCategoryId";
import { InMemoryCategoryRepository } from "@/application/tag-category/InMemoryCategoryRepository";
import { describe, expect, it } from "vitest";

import { ConfirmSheetImport } from "./ConfirmSheetImport";
import type { ExecutableImportPlan, SheetImportRepository } from "./SheetImportRepository";
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

class InMemorySheetImportRepository implements SheetImportRepository {
  persisted: ExecutableImportPlan[] = [];
  result: { movementsCreated: number; tagsCreated: number } = {
    movementsCreated: 0,
    tagsCreated: 0,
  };

  async persist(
    plan: ExecutableImportPlan,
  ): Promise<{ movementsCreated: number; tagsCreated: number }> {
    this.persisted.push(plan);
    return this.result;
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
];

function buildUseCase(tags: Tag[] = [
  Tag.rehydrate(7, "Ocio", "ocio", "active", TagCategoryId(1)),
]) {
  const accounts = new InMemoryAccountRepository(ACCOUNTS);
  const tagRepository = new InMemoryCatalogTagRepository(tags);
  const categories = new InMemoryCategoryRepository([
    TagCategory.rehydrate(1, "General", "general"),
  ]);
  const imports = new InMemorySheetImportRepository();
  return {
    tagRepository,
    imports,
    useCase: new ConfirmSheetImport(accounts, tagRepository, categories, imports),
  };
}

describe("ConfirmSheetImport", () => {
  it("plan válido → persiste solo las filas ok con sus etiquetas nuevas y devuelve los contadores", async () => {
    const { useCase, imports } = buildUseCase();
    imports.result = { movementsCreated: 2, tagsCreated: 1 };

    const result = await useCase.execute({
      accountId: 1,
      month: "2026-01",
      rows: [
        row13(2, { 1: "Carrera", 3: "Gasto", 4: "7.85", 5: "Ocio" }),
        row13(3, { 1: "Aportación Común", 3: "Gasto Fijo", 4: "1920", 5: "Hogar" }),
        row13(4, { 1: "Pienso", 3: "Gasto", 4: "18.65", 5: "Mascotas" }),
      ],
    });

    expect(result).toEqual({ status: "imported", movementsCreated: 2, tagsCreated: 1 });
    expect(imports.persisted).toHaveLength(1);
    const plan = imports.persisted[0];
    expect(plan.accountId).toBe(1);
    expect(plan.tagsToCreate).toEqual([{ name: "Mascotas", categoryId: 1 }]);
    expect(plan.movements).toEqual([
      {
        date: "2026-01-01",
        note: "Carrera",
        amountCents: 785,
        type: "expense",
        nature: "personal",
        tagName: "Ocio",
        tagId: 7,
        createsTag: false,
      },
      {
        date: "2026-01-01",
        note: "Pienso",
        amountCents: 1865,
        type: "expense",
        nature: "personal",
        tagName: "Mascotas",
        tagId: null,
        createsTag: true,
      },
    ]);
  });

  it("plan con errores → {status:\"invalid\"} sin llamar a persist (FR-005)", async () => {
    const { useCase, imports } = buildUseCase();

    const result = await useCase.execute({
      accountId: 1,
      month: "2026-01",
      rows: [
        row13(2, { 1: "Carrera", 3: "Gasto", 4: "7.85", 5: "Ocio" }),
        row13(3, { 1: "Roto", 3: "Gasto", 4: "abc", 5: "Ocio" }),
      ],
    });

    expect(result).toEqual({ status: "invalid" });
    expect(imports.persisted).toHaveLength(0);
  });

  it("plan con 0 movimientos (todas ignoradas) → {status:\"invalid\"} sin persistir", async () => {
    const { useCase, imports } = buildUseCase();

    const result = await useCase.execute({
      accountId: 1,
      month: "2026-01",
      rows: [
        row13(2, { 1: "Aportación Común", 3: "Gasto Fijo", 4: "1920", 5: "Hogar" }),
        row13(3, { 1: "Ahorros", 3: "Ahorro", 4: "600", 5: "Ahorros" }),
      ],
    });

    expect(result).toEqual({ status: "invalid" });
    expect(imports.persisted).toHaveLength(0);
  });

  it("el plan se recalcula fresco desde las filas: si el catálogo cambió y ahora hay errores, no persiste", async () => {
    const tags = [
      Tag.rehydrate(7, "Ocio", "ocio", "active", TagCategoryId(1)),
      Tag.rehydrate(9, "Mascotas", "mascotas", "inactive", TagCategoryId(1)),
    ];
    const { useCase, imports } = buildUseCase(tags);

    const result = await useCase.execute({
      accountId: 1,
      month: "2026-01",
      rows: [row13(2, { 1: "Pienso", 3: "Gasto", 4: "18.65", 5: "Mascotas" })],
    });

    expect(result).toEqual({ status: "invalid" });
    expect(imports.persisted).toHaveLength(0);
  });
});
