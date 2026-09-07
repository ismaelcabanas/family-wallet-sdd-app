import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const members = sqliteTable("members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
});

export type MemberRow = typeof members.$inferSelect;
export type NewMemberRow = typeof members.$inferInsert;
