import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { accounts } from "./accounts";

export const savingsAllocations = sqliteTable("savings_allocations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id")
    .notNull()
    .unique()
    .references(() => accounts.id),
  percentage: integer("percentage").notNull(),
  active: integer("active").notNull(),
  activatedAtMonth: text("activated_at_month").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
});

export const savingsAllocationMonths = sqliteTable(
  "savings_allocation_months",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    savingsAllocationId: integer("savings_allocation_id")
      .notNull()
      .references(() => savingsAllocations.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    amountCents: integer("amount_cents").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("savings_allocation_months_config_month_uq").on(
      table.savingsAllocationId,
      table.month,
    ),
  ],
);

export type SavingsAllocationRow = typeof savingsAllocations.$inferSelect;
export type NewSavingsAllocationRow = typeof savingsAllocations.$inferInsert;
export type SavingsAllocationMonthRow = typeof savingsAllocationMonths.$inferSelect;
export type NewSavingsAllocationMonthRow = typeof savingsAllocationMonths.$inferInsert;
