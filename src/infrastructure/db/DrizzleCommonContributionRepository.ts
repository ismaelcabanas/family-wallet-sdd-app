import type { CommonContributionRepository } from "@/application/common-contribution/CommonContributionRepository";
import { AccountId } from "@/domain/account/AccountId";
import type { Movement } from "@/domain/movement/Movement";
import { CommonContribution } from "@/domain/common-contribution/CommonContribution";
import type { CommonContributionId } from "@/domain/common-contribution/CommonContributionId";
import { eq, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

import { mapMovementToRow } from "./mappers/movement.mapper";
import { mapCommonContributionToRow, mapRowToCommonContribution } from "./mappers/common-contribution.mapper";
import { movements } from "./schema/movements";
import { commonContributionMonths, commonContributions } from "./schema/common-contributions";
import type * as schema from "./schema";

export class DrizzleCommonContributionRepository implements CommonContributionRepository {
  constructor(private readonly db: LibSQLDatabase<typeof schema>) {}

  async findByAccountId(accountId: AccountId): Promise<CommonContribution | null> {
    const rows = await this.db
      .select()
      .from(commonContributions)
      .where(eq(commonContributions.accountId, accountId as number))
      .limit(1);

    return rows.length > 0 ? mapRowToCommonContribution(rows[0]) : null;
  }

  async save(config: CommonContribution): Promise<CommonContribution> {
    const { id: _ignoredId, ...row } = mapCommonContributionToRow(config);
    void _ignoredId;

    const [saved] = await this.db
      .insert(commonContributions)
      .values(row)
      .onConflictDoUpdate({
        target: commonContributions.accountId,
        set: {
          percentageBasisPoints: row.percentageBasisPoints,
          active: row.active,
          activatedAtMonth: row.activatedAtMonth,
          updatedAt: new Date().toISOString(),
        },
      })
      .returning();

    return mapRowToCommonContribution(saved);
  }

  async isMaterialized(contributionId: CommonContributionId, month: string): Promise<boolean> {
    const rows = await this.db
      .select({ one: sql<number>`1` })
      .from(commonContributionMonths)
      .where(
        sql`${commonContributionMonths.commonContributionId} = ${contributionId} and ${commonContributionMonths.month} = ${month}`,
      )
      .limit(1);

    return rows.length > 0;
  }

  async registerMaterialization(
    config: CommonContribution,
    month: string,
    movement: Movement,
  ): Promise<boolean> {
    if (config.id === null) {
      throw new RangeError("registerMaterialization requiere una configuración persistida");
    }

    return this.db.transaction(async (tx) => {
      const registeredRows = await tx
        .insert(commonContributionMonths)
        .values({
          commonContributionId: config.id as number,
          month,
          createdAt: new Date().toISOString(),
        })
        .onConflictDoNothing({
          target: [commonContributionMonths.commonContributionId, commonContributionMonths.month],
        })
        .returning({ id: commonContributionMonths.id });

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
