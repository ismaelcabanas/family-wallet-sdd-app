import type {
  ExecutableImportPlan,
  SheetImportRepository,
} from "@/application/import/SheetImportRepository";
import type { PlannedMovement } from "@/application/import/sheet-import-plan";
import { AccountId } from "@/domain/account/AccountId";
import { Movement } from "@/domain/movement/Movement";
import { Money } from "@/domain/movement/Money";
import { Tag } from "@/domain/tag/Tag";
import { TagId } from "@/domain/tag/TagId";
import { deriveTagSlug } from "@/domain/tag/TagSlug";
import { TagCategoryId } from "@/domain/tag-category/TagCategoryId";
import { eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

import { movements } from "./schema/movements";
import { tags } from "./schema/tags";
import type * as schema from "./schema";

export class DrizzleSheetImportRepository implements SheetImportRepository {
  constructor(private readonly db: LibSQLDatabase<typeof schema>) {}

  async persist(
    plan: ExecutableImportPlan,
  ): Promise<{ movementsCreated: number; tagsCreated: number }> {
    return this.db.transaction(async (tx) => {
      const createdTagIdsByLowerName = new Map<string, number>();

      for (const tagToCreate of plan.tagsToCreate) {
        const base = deriveTagSlug(tagToCreate.name);
        let slug = base;
        let suffix = 2;
        while (
          (await tx.select({ id: tags.id }).from(tags).where(eq(tags.slug, slug)).limit(1))
            .length > 0
        ) {
          slug = `${base}-${suffix}`;
          suffix += 1;
        }

        const tag = Tag.create({
          name: tagToCreate.name,
          slug,
          status: "active",
          categoryId: TagCategoryId(tagToCreate.categoryId),
        });

        const rows = await tx
          .insert(tags)
          .values({
            name: tag.name,
            slug: tag.slug,
            status: tag.status,
            categoryId: tag.categoryId,
          })
          .returning({ id: tags.id });

        createdTagIdsByLowerName.set(tag.name.toLowerCase(), rows[0].id);
      }

      const accountId = AccountId(plan.accountId);

      for (const movement of plan.movements) {
        const entity = buildMovement(accountId, movement, createdTagIdsByLowerName);
        await tx.insert(movements).values({
          accountId: entity.accountId,
          type: entity.type,
          date: entity.date,
          note: entity.note,
          amountCents: entity.amount.amountCents,
          nature: entity.nature,
          tagId: entity.tagId,
          createdAt: entity.createdAt,
        });
      }

      return { movementsCreated: plan.movements.length, tagsCreated: plan.tagsToCreate.length };
    });
  }
}

function buildMovement(
  accountId: AccountId,
  movement: PlannedMovement,
  createdTagIdsByLowerName: Map<string, number>,
): Movement {
  const tagId =
    movement.createsTag && movement.tagName !== null
      ? (createdTagIdsByLowerName.get(movement.tagName.toLowerCase()) ?? null)
      : movement.tagId;

  return Movement.create({
    accountId,
    type: movement.type,
    date: movement.date,
    note: movement.note,
    amount: Money.fromCents(movement.amountCents),
    nature: movement.nature,
    tagId: tagId === null ? null : TagId(tagId),
  });
}
