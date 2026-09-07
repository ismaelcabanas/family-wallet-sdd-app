import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { members } from "./members";

export const accounts = sqliteTable("accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  type: text("type").notNull(),
  memberId: integer("member_id").references(() => members.id),
});

export type AccountRow = typeof accounts.$inferSelect;
export type NewAccountRow = typeof accounts.$inferInsert;
