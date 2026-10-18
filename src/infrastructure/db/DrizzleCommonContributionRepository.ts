import type { CommonContributionRepository } from "@/application/common-contribution/CommonContributionRepository";
import { AccountId } from "@/domain/account/AccountId";
import type { Movement } from "@/domain/movement/Movement";
import { CommonContribution } from "@/domain/common-contribution/CommonContribution";
import type { CommonContributionId } from "@/domain/common-contribution/CommonContributionId";
import { and, eq, like, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

import { mapMovementToRow, mapRowToMovement } from "./mappers/movement.mapper";
import { mapCommonContributionToRow, mapRowToCommonContribution } from "./mappers/common-contribution.mapper";
import { movements } from "./schema/movements";
import { commonContributionMonths, commonContributions } from "./schema/common-contributions";
import { tags } from "./schema/tags";
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
      const [idRow] = await tx
        .select({ nextId: sql<number>`coalesce(max(${movements.id}), 0) + 1` })
        .from(movements);
      const movementId = idRow?.nextId ?? 1;

      const registeredRows = await tx
        .insert(commonContributionMonths)
        .values({
          commonContributionId: config.id as number,
          month,
          createdAt: new Date().toISOString(),
          movementId,
        })
        .onConflictDoNothing({
          target: [commonContributionMonths.commonContributionId, commonContributionMonths.month],
        })
        .returning({ id: commonContributionMonths.id });

      if (registeredRows.length === 0) {
        return false;
      }

      await tx.insert(movements).values({ id: movementId, ...mapMovementToRow(movement) });

      return true;
    });
  }

  async findMaterializedMovement(
    contributionId: CommonContributionId,
    month: string,
  ): Promise<Movement | null> {
    const [monthRow] = await this.db
      .select()
      .from(commonContributionMonths)
      .where(
        and(
          eq(commonContributionMonths.commonContributionId, contributionId as number),
          eq(commonContributionMonths.month, month),
        ),
      )
      .limit(1);

    if (monthRow === undefined) {
      return null;
    }

    if (monthRow.movementId !== null) {
      const [movementRow] = await this.db
        .select()
        .from(movements)
        .where(eq(movements.id, monthRow.movementId));
      return movementRow === undefined ? null : mapRowToMovement(movementRow);
    }

    const config = await this.findByAccountIdForContribution(contributionId);
    const [legacyRow] = await this.db
      .select({ id: movements.id })
      .from(movements)
      .innerJoin(tags, eq(tags.id, movements.tagId))
      .where(
        and(
          eq(movements.accountId, config.accountId as number),
          eq(movements.date, `${month}-01`),
          eq(movements.type, "expense"),
          eq(movements.nature, "personal"),
          eq(tags.slug, "aportacion-comun"),
          like(movements.note, "Aportación común de %"),
        ),
      )
      .orderBy(movements.id)
      .limit(1);

    if (legacyRow === undefined) {
      return null;
    }

    await this.db
      .update(commonContributionMonths)
      .set({ movementId: legacyRow.id })
      .where(eq(commonContributionMonths.id, monthRow.id));

    const [movementRow] = await this.db
      .select()
      .from(movements)
      .where(eq(movements.id, legacyRow.id));
    return movementRow === undefined ? null : mapRowToMovement(movementRow);
  }

  async withdrawMaterialization(
    contributionId: CommonContributionId,
    month: string,
  ): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [monthRow] = await tx
        .select()
        .from(commonContributionMonths)
        .where(
          and(
            eq(commonContributionMonths.commonContributionId, contributionId as number),
            eq(commonContributionMonths.month, month),
          ),
        )
        .limit(1);

      if (monthRow === undefined) {
        return false;
      }

      if (monthRow.movementId !== null) {
        await tx.delete(movements).where(eq(movements.id, monthRow.movementId));
      }

      await tx
        .delete(commonContributionMonths)
        .where(eq(commonContributionMonths.id, monthRow.id));

      return true;
    });
  }

  private async findByAccountIdForContribution(
    contributionId: CommonContributionId,
  ): Promise<{ accountId: AccountId }> {
    const [row] = await this.db
      .select({ accountId: commonContributions.accountId })
      .from(commonContributions)
      .where(eq(commonContributions.id, contributionId as number))
      .limit(1);

    if (row === undefined) {
      throw new RangeError(`No existe la configuración de aportación ${contributionId}`);
    }

    return { accountId: AccountId(row.accountId) };
  }
}
