import type { AccountRepository } from "@/application/account/AccountRepository";
import { AccountNotFoundError } from "@/domain/account/AccountErrors";
import { DEFAULT_CATEGORY_SLUG } from "@/domain/tag-category/DefaultCategory";
import { CategoryNotFoundError } from "@/domain/tag-category/TagCategoryErrors";
import type { TagRepository } from "@/application/tag/TagRepository";
import type { CategoryRepository } from "@/application/tag-category/CategoryRepository";

import type { SheetImportPreviewDTO } from "./dto";
import { buildSheetImportPlan, type SheetCellsRow } from "./sheet-import-plan";

export interface BuildSheetImportPreviewInput {
  accountId: number;
  month: string;
  rows: SheetCellsRow[];
}

export class BuildSheetImportPreview {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly tags: TagRepository,
    private readonly categories: CategoryRepository,
  ) {}

  async execute(input: BuildSheetImportPreviewInput): Promise<SheetImportPreviewDTO> {
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

    return {
      accountName: account.name,
      month: input.month,
      rows: plan.rows.map((row) => {
        if (row.status === "ok") {
          return {
            line: row.line,
            status: "ok" as const,
            movement: {
              date: row.movement.date,
              note: row.movement.note,
              amountCents: row.movement.amountCents,
              type: row.movement.type,
              nature: row.movement.nature,
              tagName: row.movement.tagName,
              createsTag: row.movement.createsTag,
            },
          };
        }
        return { line: row.line, status: row.status, reason: row.reason };
      }),
      totals: plan.totals,
      tagsToCreate: plan.tagsToCreate.map((tag) => tag.name),
    };
  }
}
