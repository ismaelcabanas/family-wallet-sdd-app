import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

export const members = sqliteTable(
  "members",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
  },
  (table) => [uniqueIndex("members_name_nocase_uq").on(sql`lower(${table.name})`)],
);

export type MemberRow = typeof members.$inferSelect;
export type NewMemberRow = typeof members.$inferInsert;
