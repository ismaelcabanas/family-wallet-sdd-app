import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { members } from "./members";

export const accounts = sqliteTable(
  "accounts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name"),
    type: text("type").notNull(),
    memberId: integer("member_id").references(() => members.id),
  },
  (table) => [uniqueIndex("accounts_name_nocase_uq").on(sql`lower(${table.name})`)],
);

export type AccountRow = typeof accounts.$inferSelect;
export type NewAccountRow = typeof accounts.$inferInsert;
