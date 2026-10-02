import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { accounts } from "./accounts";
import { tags } from "./tags";

export const movements = sqliteTable(
  "movements",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id),
    type: text("type").notNull(),
    date: text("date").notNull(),
    note: text("note").notNull(),
    amountCents: integer("amount_cents").notNull(),
    nature: text("nature"),
    tagId: integer("tag_id").references(() => tags.id, { onDelete: "restrict" }),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at"),
  },
  (table) => [index("idx_movements_account_date").on(table.accountId, table.date)],
);

export type MovementRow = typeof movements.$inferSelect;
export type NewMovementRow = typeof movements.$inferInsert;
