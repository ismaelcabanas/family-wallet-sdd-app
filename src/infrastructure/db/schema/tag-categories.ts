import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const tagCategories = sqliteTable(
  "tag_categories",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
  },
  (table) => [uniqueIndex("tag_categories_name_nocase_uq").on(sql`lower(${table.name})`)],
);

export type TagCategoryRow = typeof tagCategories.$inferSelect;
export type NewTagCategoryRow = typeof tagCategories.$inferInsert;
