import type { TagRepository } from "@/application/tag/TagRepository";
import { Tag } from "@/domain/tag/Tag";
import { TagId } from "@/domain/tag/TagId";
import { asc, eq, inArray } from "drizzle-orm";
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
}
