import type { SavingsAllocationRepository } from "@/application/savings/SavingsAllocationRepository";
import { AccountId } from "@/domain/account/AccountId";
import type { SavingsAllocation } from "@/domain/savings/SavingsAllocation";
import type { SavingsAllocationId } from "@/domain/savings/SavingsAllocationId";
import { and, eq, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

import { mapSavingsAllocationToRow, mapRowToSavingsAllocation } from "./mappers/savings-allocation.mapper";
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

  async registerDeduction(
    config: SavingsAllocation,
    month: string,
    amountCents: number,
  ): Promise<boolean> {
    if (config.id === null) {
      throw new RangeError("registerDeduction requiere una configuración persistida");
    }

    return this.db.transaction(async (tx) => {
      const registeredRows = await tx
        .insert(savingsAllocationMonths)
        .values({
          savingsAllocationId: config.id as number,
          month,
          amountCents,
          createdAt: new Date().toISOString(),
        })
        .onConflictDoNothing({
          target: [savingsAllocationMonths.savingsAllocationId, savingsAllocationMonths.month],
        })
        .returning({ id: savingsAllocationMonths.id });

      return registeredRows.length > 0;
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
}
