import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { tagCategories } from "./tag-categories";

export const tags = sqliteTable(
  "tags",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    status: text("status").notNull().default("active"),
    categoryId: integer("category_id")
      .notNull()
      .references(() => tagCategories.id, { onDelete: "restrict" }),
  },
  (table) => [uniqueIndex("tags_name_nocase_uq").on(sql`lower(${table.name})`)],
);

export type TagRow = typeof tags.$inferSelect;
export type NewTagRow = typeof tags.$inferInsert;
