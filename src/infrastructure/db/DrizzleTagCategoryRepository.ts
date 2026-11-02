import type { CategoryRepository } from "@/application/tag-category/CategoryRepository";
import { TagCategory } from "@/domain/tag-category/TagCategory";
import { TagCategoryId } from "@/domain/tag-category/TagCategoryId";
import {
  CategoryNotEmptyError,
  DuplicateCategoryNameError,
} from "@/domain/tag-category/TagCategoryErrors";
import { asc, eq, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

import { mapRowToTagCategory } from "./mappers/tag-category.mapper";
import { tagCategories } from "./schema/tag-categories";
import { tags } from "./schema/tags";
import type * as schema from "./schema";

export class DrizzleTagCategoryRepository implements CategoryRepository {
  constructor(private readonly db: LibSQLDatabase<typeof schema>) {}

  async findAll(): Promise<TagCategory[]> {
    const rows = await this.db.select().from(tagCategories).orderBy(asc(tagCategories.name));
    return rows.map(mapRowToTagCategory);
  }

  async findById(id: TagCategoryId): Promise<TagCategory | null> {
    const rows = await this.db.select().from(tagCategories).where(eq(tagCategories.id, id)).limit(1);
    return rows.length > 0 ? mapRowToTagCategory(rows[0]) : null;
  }

  async findBySlug(slug: string): Promise<TagCategory | null> {
    const rows = await this.db
      .select()
      .from(tagCategories)
      .where(eq(tagCategories.slug, slug))
      .limit(1);
    return rows.length > 0 ? mapRowToTagCategory(rows[0]) : null;
  }

  async findByName(name: string): Promise<TagCategory | null> {
    const rows = await this.db
      .select()
      .from(tagCategories)
      .where(sql`lower(${tagCategories.name}) = lower(${name})`)
      .limit(1);
    return rows.length > 0 ? mapRowToTagCategory(rows[0]) : null;
  }

  async save(category: TagCategory): Promise<TagCategory> {
    try {
      const rows = await this.db
        .insert(tagCategories)
        .values({ name: category.name, slug: category.slug })
        .returning();
      return mapRowToTagCategory(rows[0]);
    } catch (error) {
      throw this.translateUniqueViolation(error, category);
    }
  }

  async update(category: TagCategory): Promise<TagCategory> {
    if (category.id === null) {
      throw new RangeError("update requiere una categoría persistida");
    }
    try {
      const rows = await this.db
        .update(tagCategories)
        .set({ name: category.name })
        .where(eq(tagCategories.id, category.id))
        .returning();
      return mapRowToTagCategory(rows[0]);
    } catch (error) {
      throw this.translateUniqueViolation(error, category);
    }
  }

  async delete(id: TagCategoryId): Promise<void> {
    try {
      await this.db.delete(tagCategories).where(eq(tagCategories.id, id));
    } catch (error) {
      if (this.isForeignKeyViolation(error)) {
        const category = await this.findById(id);
        throw new CategoryNotEmptyError(category?.name ?? "");
      }
      throw error;
    }
  }

  async countTags(id: TagCategoryId): Promise<number> {
    const rows = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(tags)
      .where(eq(tags.categoryId, id));
    return Number(rows[0]?.count ?? 0);
  }

  private translateUniqueViolation(error: unknown, category: TagCategory): Error {
    const messages = [
      error instanceof Error ? error.message : "",
      error instanceof Error && error.cause instanceof Error ? error.cause.message : "",
    ];
    if (messages.some((message) => message.includes("tag_categories_name_nocase_uq"))) {
      return new DuplicateCategoryNameError(category.name);
    }
    return error as Error;
  }

  private isForeignKeyViolation(error: unknown): boolean {
    const messages = [
      error instanceof Error ? error.message : "",
      error instanceof Error && error.cause instanceof Error ? error.cause.message : "",
    ];
    return messages.some((message) => message.includes("FOREIGN KEY constraint failed"));
  }
}
