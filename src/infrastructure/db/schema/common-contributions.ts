import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { accounts } from "./accounts";

export const commonContributions = sqliteTable("common_contributions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id")
    .notNull()
    .unique()
    .references(() => accounts.id),
  percentageBasisPoints: integer("percentage_basis_points").notNull(),
  active: integer("active").notNull(),
  activatedAtMonth: text("activated_at_month").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
});

export const commonContributionMonths = sqliteTable(
  "common_contribution_months",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    commonContributionId: integer("common_contribution_id")
      .notNull()
      .references(() => commonContributions.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("common_contribution_months_config_month_uq").on(
      table.commonContributionId,
      table.month,
    ),
  ],
);

export type CommonContributionRow = typeof commonContributions.$inferSelect;
export type NewCommonContributionRow = typeof commonContributions.$inferInsert;
export type CommonContributionMonthRow = typeof commonContributionMonths.$inferSelect;
export type NewCommonContributionMonthRow = typeof commonContributionMonths.$inferInsert;
