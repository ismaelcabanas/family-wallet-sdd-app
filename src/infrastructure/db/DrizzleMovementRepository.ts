import type { MovementDTO } from "@/application/movement/dto";
import type { MovementRepository } from "@/application/movement/MovementRepository";
import { AccountId } from "@/domain/account/AccountId";
import { Movement } from "@/domain/movement/Movement";
import { MovementId } from "@/domain/movement/MovementId";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

import {
  mapJoinedRowToMovementDTO,
  mapMovementToRow,
  mapRowToMovement,
} from "./mappers/movement.mapper";
import { movements } from "./schema/movements";
import { tags } from "./schema/tags";
import type * as schema from "./schema";

function nextMonthFirstDay(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const nextYear = monthNumber === 12 ? year + 1 : year;
  const nextMonthNumber = monthNumber === 12 ? 1 : monthNumber + 1;
  return `${nextYear}-${String(nextMonthNumber).padStart(2, "0")}-01`;
}

export class DrizzleMovementRepository implements MovementRepository {
  constructor(private readonly db: LibSQLDatabase<typeof schema>) {}

  async create(movement: Movement): Promise<MovementId> {
    const [idRow] = await this.db
      .select({ nextId: sql<number>`coalesce(max(${movements.id}), 0) + 1` })
      .from(movements);
    const movementId = idRow?.nextId ?? 1;

    await this.db.insert(movements).values({ id: movementId, ...mapMovementToRow(movement) });

    return MovementId(movementId);
  }

  async listByMonthAndAccount(accountId: AccountId, month: string): Promise<MovementDTO[]> {
    const rows = await this.selectMonthRows().where(
      and(
        eq(movements.accountId, accountId as number),
        gte(movements.date, `${month}-01`),
        lt(movements.date, nextMonthFirstDay(month)),
      ),
    );

    return rows.map(mapJoinedRowToMovementDTO);
  }

  async listByMonth(month: string): Promise<MovementDTO[]> {
    const rows = await this.selectMonthRows().where(
      and(gte(movements.date, `${month}-01`), lt(movements.date, nextMonthFirstDay(month))),
    );

    return rows.map(mapJoinedRowToMovementDTO);
  }

  async listByYear(year: string): Promise<MovementDTO[]> {
    const nextYear = Number(year) + 1;
    const rows = await this.selectMonthRows().where(
      and(gte(movements.date, `${year}-01-01`), lt(movements.date, `${nextYear}-01-01`)),
    );

    return rows.map(mapJoinedRowToMovementDTO);
  }

  private selectMonthRows() {
    return this.db
      .select({
        id: movements.id,
        accountId: movements.accountId,
        type: movements.type,
        date: movements.date,
        note: movements.note,
        amountCents: movements.amountCents,
        nature: movements.nature,
        tagId: tags.id,
        tagName: tags.name,
        tagSlug: tags.slug,
      })
      .from(movements)
      .leftJoin(tags, eq(tags.id, movements.tagId))
      .orderBy(desc(movements.date), desc(movements.id))
      .$dynamic();
  }

  async findById(id: MovementId): Promise<Movement | null> {
    const rows = await this.db
      .select()
      .from(movements)
      .where(eq(movements.id, id as number));

    if (rows.length === 0) return null;

    return mapRowToMovement(rows[0]);
  }

  async update(movement: Movement): Promise<void> {
    const movementId = movement.id;
    if (movementId === null) {
      throw new RangeError("update requiere un movimiento con id (usar create para nuevos)");
    }

    const { createdAt: _ignoredCreatedAt, ...row } = mapMovementToRow(movement);
    void _ignoredCreatedAt;

    await this.db
      .update(movements)
      .set({ ...row, updatedAt: new Date().toISOString() })
      .where(eq(movements.id, movementId as number));
  }

  async delete(id: MovementId): Promise<void> {
    await this.db.delete(movements).where(eq(movements.id, id as number));
  }
}
