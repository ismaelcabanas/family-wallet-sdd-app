import type { RegularIncomeRepository } from "@/application/regular-income/RegularIncomeRepository";
import { AccountId } from "@/domain/account/AccountId";
import type { Movement } from "@/domain/movement/Movement";
import { RegularIncome } from "@/domain/regular-income/RegularIncome";
import type { RegularIncomeId } from "@/domain/regular-income/RegularIncomeId";
import { eq, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

import { mapMovementToRow } from "./mappers/movement.mapper";
import { mapRegularIncomeToRow, mapRowToRegularIncome } from "./mappers/regular-income.mapper";
import { movements } from "./schema/movements";
import { regularIncomes, regularIncomeMonths } from "./schema/regular-incomes";
import type * as schema from "./schema";

export class DrizzleRegularIncomeRepository implements RegularIncomeRepository {
  constructor(private readonly db: LibSQLDatabase<typeof schema>) {}

  async findByAccountId(accountId: AccountId): Promise<RegularIncome | null> {
    const rows = await this.db
      .select()
      .from(regularIncomes)
      .where(eq(regularIncomes.accountId, accountId as number))
      .limit(1);

    return rows.length > 0 ? mapRowToRegularIncome(rows[0]) : null;
  }

  async save(config: RegularIncome): Promise<RegularIncome> {
    const { id: _ignoredId, ...row } = mapRegularIncomeToRow(config);
    void _ignoredId;

    const [saved] = await this.db
      .insert(regularIncomes)
      .values(row)
      .onConflictDoUpdate({
        target: regularIncomes.accountId,
        set: {
          amountCents: row.amountCents,
          dayOfMonth: row.dayOfMonth,
          note: row.note,
          active: row.active,
          activatedAtMonth: row.activatedAtMonth,
          updatedAt: new Date().toISOString(),
        },
      })
      .returning();

    return mapRowToRegularIncome(saved);
  }

  async isMaterialized(regularIncomeId: RegularIncomeId, month: string): Promise<boolean> {
    const rows = await this.db
      .select({ one: sql<number>`1` })
      .from(regularIncomeMonths)
      .where(
        sql`${regularIncomeMonths.regularIncomeId} = ${regularIncomeId} and ${regularIncomeMonths.month} = ${month}`,
      )
      .limit(1);

    return rows.length > 0;
  }

  async registerMaterialization(
    config: RegularIncome,
    month: string,
    movement: Movement,
  ): Promise<boolean> {
    if (config.id === null) {
      throw new RangeError("registerMaterialization requiere una configuración persistida");
    }

    return this.db.transaction(async (tx) => {
      const registeredRows = await tx
        .insert(regularIncomeMonths)
        .values({
          regularIncomeId: config.id as number,
          month,
          createdAt: new Date().toISOString(),
        })
        .onConflictDoNothing({
          target: [regularIncomeMonths.regularIncomeId, regularIncomeMonths.month],
        })
        .returning({ id: regularIncomeMonths.id });

      if (registeredRows.length === 0) {
        return false;
      }

      const [idRow] = await tx
        .select({ nextId: sql<number>`coalesce(max(${movements.id}), 0) + 1` })
        .from(movements);
      const movementId = idRow?.nextId ?? 1;

      await tx.insert(movements).values({ id: movementId, ...mapMovementToRow(movement) });

      return true;
    });
  }
}
