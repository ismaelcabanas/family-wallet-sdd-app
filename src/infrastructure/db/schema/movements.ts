import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { accounts } from "./accounts";

export const movements = sqliteTable(
  "movements",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id),
    type: text("type").notNull(),
    date: text("date").notNull(),
    concept: text("concept").notNull(),
    description: text("description"),
    amountCents: integer("amount_cents").notNull(),
    nature: text("nature"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_movements_account_date").on(table.accountId, table.date)],
);

export type MovementRow = typeof movements.$inferSelect;
export type NewMovementRow = typeof movements.$inferInsert;
