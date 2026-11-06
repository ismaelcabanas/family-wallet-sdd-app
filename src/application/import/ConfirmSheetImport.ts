import type { AccountRepository } from "@/application/account/AccountRepository";
import { AccountNotFoundError } from "@/domain/account/AccountErrors";
import { DEFAULT_CATEGORY_SLUG } from "@/domain/tag-category/DefaultCategory";
import { CategoryNotFoundError } from "@/domain/tag-category/TagCategoryErrors";
import type { TagRepository } from "@/application/tag/TagRepository";
import type { CategoryRepository } from "@/application/tag-category/CategoryRepository";

import { buildSheetImportPlan, type SheetCellsRow } from "./sheet-import-plan";
import type { SheetImportRepository } from "./SheetImportRepository";

export interface ConfirmSheetImportInput {
  accountId: number;
  month: string;
  rows: SheetCellsRow[];
}

export type ConfirmSheetImportResult =
  | { status: "imported"; movementsCreated: number; tagsCreated: number }
  | { status: "invalid" };

export class ConfirmSheetImport {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly tags: TagRepository,
    private readonly categories: CategoryRepository,
    private readonly imports: SheetImportRepository,
  ) {}

  async execute(input: ConfirmSheetImportInput): Promise<ConfirmSheetImportResult> {
    const account = (await this.accounts.findAll()).find(
      (candidate) => candidate.id === input.accountId,
    );
    if (account === undefined) {
      throw new AccountNotFoundError();
    }

    const defaultCategory = await this.categories.findBySlug(DEFAULT_CATEGORY_SLUG);
    if (defaultCategory === null || defaultCategory.id === null) {
      throw new CategoryNotFoundError();
    }

    const allTags = await this.tags.findAll();
    const plan = buildSheetImportPlan({
      month: input.month,
      rows: input.rows,
      activeTags: allTags
        .filter((tag) => tag.status === "active" && tag.id !== null)
        .map((tag) => ({ id: tag.id as number, name: tag.name, slug: tag.slug })),
      inactiveTagNames: allTags.filter((tag) => tag.status !== "active").map((tag) => tag.name),
      defaultCategoryId: defaultCategory.id,
    });

    if (plan.hasErrors || plan.totals.movements === 0) {
      return { status: "invalid" };
    }

    const result = await this.imports.persist({
      accountId: input.accountId,
      movements: plan.rows.flatMap((row) => (row.status === "ok" ? [row.movement] : [])),
      tagsToCreate: plan.tagsToCreate,
    });

    return { status: "imported", movementsCreated: result.movementsCreated, tagsCreated: result.tagsCreated };
  }
}
