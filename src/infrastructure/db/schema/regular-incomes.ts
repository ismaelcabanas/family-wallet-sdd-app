import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { accounts } from "./accounts";

export const regularIncomes = sqliteTable("regular_incomes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id")
    .notNull()
    .unique()
    .references(() => accounts.id),
  amountCents: integer("amount_cents").notNull(),
  dayOfMonth: integer("day_of_month").notNull(),
  note: text("note").notNull(),
  active: integer("active").notNull(),
  activatedAtMonth: text("activated_at_month").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
});

export const regularIncomeMonths = sqliteTable(
  "regular_income_months",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    regularIncomeId: integer("regular_income_id")
      .notNull()
      .references(() => regularIncomes.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("regular_income_months_config_month_uq").on(table.regularIncomeId, table.month),
  ],
);

export type RegularIncomeRow = typeof regularIncomes.$inferSelect;
export type NewRegularIncomeRow = typeof regularIncomes.$inferInsert;
export type RegularIncomeMonthRow = typeof regularIncomeMonths.$inferSelect;
export type NewRegularIncomeMonthRow = typeof regularIncomeMonths.$inferInsert;
