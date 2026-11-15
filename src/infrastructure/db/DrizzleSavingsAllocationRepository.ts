import type { SavingsAllocationRepository } from "@/application/savings/SavingsAllocationRepository";
import { AccountId } from "@/domain/account/AccountId";
import type { Movement } from "@/domain/movement/Movement";
import { MovementId } from "@/domain/movement/MovementId";
import type { SavingsAllocation } from "@/domain/savings/SavingsAllocation";
import type { SavingsAllocationId } from "@/domain/savings/SavingsAllocationId";
import { and, eq, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

import { mapMovementToRow, mapRowToMovement } from "./mappers/movement.mapper";
import { mapSavingsAllocationToRow, mapRowToSavingsAllocation } from "./mappers/savings-allocation.mapper";
import { movements } from "./schema/movements";
import { savingsAllocationMonths, savingsAllocations } from "./schema/savings-allocations";
import type * as schema from "./schema";

export class DrizzleSavingsAllocationRepository implements SavingsAllocationRepository {
  constructor(private readonly db: LibSQLDatabase<typeof schema>) {}

  async findByAccountId(accountId: AccountId): Promise<SavingsAllocation | null> {
    const rows = await this.db
      .select()
      .from(savingsAllocations)
      .where(eq(savingsAllocations.accountId, accountId as number))
      .limit(1);

    return rows.length > 0 ? mapRowToSavingsAllocation(rows[0]) : null;
  }

  async save(config: SavingsAllocation): Promise<SavingsAllocation> {
    const { id: _ignoredId, ...row } = mapSavingsAllocationToRow(config);
    void _ignoredId;

    const [saved] = await this.db
      .insert(savingsAllocations)
      .values(row)
      .onConflictDoUpdate({
        target: savingsAllocations.accountId,
        set: {
          percentage: row.percentage,
          active: row.active,
          activatedAtMonth: row.activatedAtMonth,
          updatedAt: new Date().toISOString(),
        },
      })
      .returning();

    return mapRowToSavingsAllocation(saved);
  }

  async isDeducted(allocationId: SavingsAllocationId, month: string): Promise<boolean> {
    const rows = await this.db
      .select({ one: sql<number>`1` })
      .from(savingsAllocationMonths)
      .where(
        sql`${savingsAllocationMonths.savingsAllocationId} = ${allocationId} and ${savingsAllocationMonths.month} = ${month}`,
      )
      .limit(1);

    return rows.length > 0;
  }

  async registerMaterialization(
    config: SavingsAllocation,
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
        .insert(savingsAllocationMonths)
        .values({
          savingsAllocationId: config.id as number,
          month,
          amountCents: movement.amount.amountCents,
          createdAt: new Date().toISOString(),
          movementId,
        })
        .onConflictDoNothing({
          target: [savingsAllocationMonths.savingsAllocationId, savingsAllocationMonths.month],
        })
        .returning({ id: savingsAllocationMonths.id });

      if (registeredRows.length === 0) {
        return false;
      }

      await tx.insert(movements).values({ id: movementId, ...mapMovementToRow(movement) });

      return true;
    });
  }

  async registerManualSavings(
    config: SavingsAllocation,
    month: string,
    movement: Movement,
  ): Promise<MovementId | null> {
    if (config.id === null) {
      throw new RangeError("registerManualSavings requiere una configuración persistida");
    }

    return this.db.transaction(async (tx) => {
      const [idRow] = await tx
        .select({ nextId: sql<number>`coalesce(max(${movements.id}), 0) + 1` })
        .from(movements);
      const movementId = idRow?.nextId ?? 1;

      const registeredRows = await tx
        .insert(savingsAllocationMonths)
        .values({
          savingsAllocationId: config.id as number,
          month,
          amountCents: movement.amount.amountCents,
          createdAt: new Date().toISOString(),
          movementId,
        })
        .onConflictDoUpdate({
          target: [savingsAllocationMonths.savingsAllocationId, savingsAllocationMonths.month],
          set: { movementId, amountCents: movement.amount.amountCents },
          setWhere: sql`${savingsAllocationMonths.movementId} IS NULL`,
        })
        .returning({ id: savingsAllocationMonths.id });

      if (registeredRows.length === 0) {
        return null;
      }

      await tx.insert(movements).values({ id: movementId, ...mapMovementToRow(movement) });

      return MovementId(movementId);
    });
  }

  async findDeductedAmount(
    allocationId: SavingsAllocationId,
    month: string,
  ): Promise<number | null> {
    const rows = await this.db
      .select({ amountCents: savingsAllocationMonths.amountCents })
      .from(savingsAllocationMonths)
      .where(
        and(
          eq(savingsAllocationMonths.savingsAllocationId, allocationId as number),
          eq(savingsAllocationMonths.month, month),
        ),
      )
      .limit(1);

    return rows.length > 0 ? rows[0].amountCents : null;
  }

  async findDeductedMovement(
    allocationId: SavingsAllocationId,
    month: string,
  ): Promise<Movement | null> {
    const [monthRow] = await this.db
      .select()
      .from(savingsAllocationMonths)
      .where(
        and(
          eq(savingsAllocationMonths.savingsAllocationId, allocationId as number),
          eq(savingsAllocationMonths.month, month),
        ),
      )
      .limit(1);

    if (monthRow === undefined || monthRow.movementId === null) {
      return null;
    }

    const [movementRow] = await this.db
      .select()
      .from(movements)
      .where(eq(movements.id, monthRow.movementId));
    return movementRow === undefined ? null : mapRowToMovement(movementRow);
  }

  async findDeductedMonthByMovement(movementId: MovementId): Promise<string | null> {
    const [row] = await this.db
      .select({ month: savingsAllocationMonths.month })
      .from(savingsAllocationMonths)
      .where(eq(savingsAllocationMonths.movementId, movementId as number))
      .limit(1);

    return row?.month ?? null;
  }

  async withdrawDeductionForMovement(movementId: MovementId): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [monthRow] = await tx
        .select()
        .from(savingsAllocationMonths)
        .where(eq(savingsAllocationMonths.movementId, movementId as number))
        .limit(1);

      if (monthRow === undefined) {
        return false;
      }

      await tx.delete(movements).where(eq(movements.id, movementId as number));
      await tx
        .delete(savingsAllocationMonths)
        .where(eq(savingsAllocationMonths.id, monthRow.id));

      return true;
    });
  }
}
