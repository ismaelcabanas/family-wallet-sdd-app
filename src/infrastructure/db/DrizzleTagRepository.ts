import type { TagRepository } from "@/application/tag/TagRepository";
import { Tag } from "@/domain/tag/Tag";
import { TagId } from "@/domain/tag/TagId";
import { DuplicateTagNameError } from "@/domain/tag/TagErrors";
import { asc, eq, inArray, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

import { mapRowToTag } from "./mappers/tag.mapper";
import { tags } from "./schema/tags";
import type * as schema from "./schema";

export class DrizzleTagRepository implements TagRepository {
  constructor(private readonly db: LibSQLDatabase<typeof schema>) {}

  async findAllActive(): Promise<Tag[]> {
    const rows = await this.db
      .select()
      .from(tags)
      .where(eq(tags.status, "active"))
      .orderBy(asc(tags.name));

    return rows.map(mapRowToTag);
  }

  async findByIds(ids: readonly TagId[]): Promise<Tag[]> {
    if (ids.length === 0) return [];

    const rows = await this.db
      .select()
      .from(tags)
      .where(inArray(tags.id, [...ids]));

    return rows.map(mapRowToTag);
  }

  async findBySlug(slug: string): Promise<Tag | null> {
    const rows = await this.db.select().from(tags).where(eq(tags.slug, slug)).limit(1);
    return rows.length > 0 ? mapRowToTag(rows[0]) : null;
  }

  async findByName(name: string): Promise<Tag | null> {
    const rows = await this.db
      .select()
      .from(tags)
      .where(sql`lower(${tags.name}) = lower(${name})`)
      .limit(1);
    return rows.length > 0 ? mapRowToTag(rows[0]) : null;
  }

  async save(tag: Tag): Promise<Tag> {
    try {
      const rows = await this.db
        .insert(tags)
        .values({ name: tag.name, slug: tag.slug, status: tag.status })
        .returning();
      return mapRowToTag(rows[0]);
    } catch (error) {
      throw this.translateUniqueViolation(error, tag);
    }
  }

  private translateUniqueViolation(error: unknown, tag: Tag): Error {
    const messages = [
      error instanceof Error ? error.message : "",
      error instanceof Error && error.cause instanceof Error ? error.cause.message : "",
    ];
    if (messages.some((message) => message.includes("tags_name_nocase_uq"))) {
      return new DuplicateTagNameError(tag.name);
    }
    return error as Error;
  }
}
