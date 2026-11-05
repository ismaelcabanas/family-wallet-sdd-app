import {
  AnnualCategoryExpenseReport,
  type AnnualExpenseInput,
  type CategoryExpenseRef,
} from "@/domain/movement/AnnualCategoryExpenseReport";
import type { TagCategory } from "@/domain/tag-category/TagCategory";
import type { TagCategoryId } from "@/domain/tag-category/TagCategoryId";

import type { AccountRepository } from "../account/AccountRepository";
import type { CategoryRepository } from "../tag-category/CategoryRepository";
import type { TagRepository } from "../tag/TagRepository";
import type { AnnualCategoryExpenseReportDTO } from "./dto";
import type { MovementRepository } from "./MovementRepository";

const YEAR_PATTERN = /^\d{4}$/;

export class GetAnnualCategoryExpenseReport {
  constructor(
    private readonly movements: MovementRepository,
    private readonly tags: TagRepository,
    private readonly categories: CategoryRepository,
    private readonly accounts: AccountRepository,
  ) {}

  async execute(year: string): Promise<AnnualCategoryExpenseReportDTO> {
    if (!YEAR_PATTERN.test(year)) {
      throw new Error(`Año inválido: ${year} (se espera YYYY)`);
    }

    const [movementDtos, tagEntities, categoryEntities, accountDtos] = await Promise.all([
      this.movements.listByYear(year),
      this.tags.findAll(),
      this.categories.findAll(),
      this.accounts.findAll(),
    ]);

    const categoryIdByTagId = new Map<number, number>();
    for (const tag of tagEntities) {
      if (tag.id !== null) categoryIdByTagId.set(tag.id, tag.categoryId);
    }

    const personalAccountIds = new Set(
      accountDtos.filter((dto) => dto.type === "personal").map((dto) => dto.id),
    );

    const inputs: AnnualExpenseInput[] = movementDtos.map((dto) => ({
      month: dto.date.slice(0, 7),
      type: dto.type,
      nature: dto.nature,
      amountCents: dto.amountCents,
      tagSlug: dto.tag?.slug ?? null,
      tagCategoryId: dto.tag ? (categoryIdByTagId.get(dto.tag.id) ?? null) : null,
      accountKind: personalAccountIds.has(dto.accountId) ? "personal" : "common",
    }));

    const categories: CategoryExpenseRef[] = categoryEntities
      .filter((category): category is TagCategory & { id: TagCategoryId } => category.id !== null)
      .map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
      }));

    const report = AnnualCategoryExpenseReport.fromMovements(year, inputs, categories);

    return {
      year: report.year,
      rows: report.rows.map((row) => ({
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        monthlyAmountCents: [...row.monthlyAmountCents],
        annualTotalCents: row.annualTotalCents,
        annualAverageCents: row.annualAverageCents,
      })),
      monthlyTotalCents: [...report.monthlyTotalCents],
      monthlyPersonalTotalCents: [...report.monthlyPersonalTotalCents],
      monthlyTotalAverageCents: report.monthlyTotalAverageCents,
      personalTotalAverageCents: report.personalTotalAverageCents,
    };
  }
}
