import type { MovementDTO } from "@/application/movement/dto";
import type { MovementRepository } from "@/application/movement/MovementRepository";
import { AccountId } from "@/domain/account/AccountId";
import { Movement } from "@/domain/movement/Movement";
import { MovementId } from "@/domain/movement/MovementId";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

import {
  mapJoinedRowsToMovementDTOs,
  mapMovementToRow,
  mapRowToMovement,
} from "./mappers/movement.mapper";
import { movementTags } from "./schema/movement-tags";
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

    await this.db.batch([
      this.db.insert(movements).values({ id: movementId, ...mapMovementToRow(movement) }),
      this.db
        .insert(movementTags)
        .values(movement.tagIds.map((tagId) => ({ movementId, tagId: tagId as number }))),
    ]);

    return MovementId(movementId);
  }

  async listByMonthAndAccount(accountId: AccountId, month: string): Promise<MovementDTO[]> {
    const rows = await this.db
      .select({
        id: movements.id,
        accountId: movements.accountId,
        type: movements.type,
        date: movements.date,
        concept: movements.concept,
        description: movements.description,
        amountCents: movements.amountCents,
        nature: movements.nature,
        createdAt: movements.createdAt,
        tagId: tags.id,
        tagName: tags.name,
        tagSlug: tags.slug,
      })
      .from(movements)
      .leftJoin(movementTags, eq(movementTags.movementId, movements.id))
      .leftJoin(tags, eq(tags.id, movementTags.tagId))
      .where(
        and(
          eq(movements.accountId, accountId as number),
          gte(movements.date, `${month}-01`),
          lt(movements.date, nextMonthFirstDay(month)),
        ),
      )
      .orderBy(desc(movements.date), desc(movements.id));

    return mapJoinedRowsToMovementDTOs(rows);
  }

  async findById(id: MovementId): Promise<Movement | null> {
    const rows = await this.db
      .select({
        id: movements.id,
        accountId: movements.accountId,
        type: movements.type,
        date: movements.date,
        concept: movements.concept,
        description: movements.description,
        amountCents: movements.amountCents,
        nature: movements.nature,
        createdAt: movements.createdAt,
        tagId: tags.id,
        tagName: tags.name,
        tagSlug: tags.slug,
      })
      .from(movements)
      .leftJoin(movementTags, eq(movementTags.movementId, movements.id))
      .leftJoin(tags, eq(tags.id, movementTags.tagId))
      .where(eq(movements.id, id as number));

    if (rows.length === 0) return null;

    const row = rows[0];
    const tagIds = rows
      .map((joined) => joined.tagId)
      .filter((tagId): tagId is number => tagId !== null);

    return mapRowToMovement(
      {
        id: row.id,
        accountId: row.accountId,
        type: row.type,
        date: row.date,
        concept: row.concept,
        description: row.description,
        amountCents: row.amountCents,
        nature: row.nature,
        createdAt: row.createdAt,
        updatedAt: null,
      },
      tagIds,
    );
  }

  async update(movement: Movement): Promise<void> {
    const movementId = movement.id;
    if (movementId === null) {
      throw new RangeError("update requiere un movimiento con id (usar create para nuevos)");
    }

    const { createdAt: _ignoredCreatedAt, ...row } = mapMovementToRow(movement);
    void _ignoredCreatedAt;

    await this.db.batch([
      this.db
        .update(movements)
        .set({ ...row, updatedAt: new Date().toISOString() })
        .where(eq(movements.id, movementId as number)),
      this.db.delete(movementTags).where(eq(movementTags.movementId, movementId as number)),
      this.db
        .insert(movementTags)
        .values(
          movement.tagIds.map((tagId) => ({
            movementId: movementId as number,
            tagId: tagId as number,
          })),
        ),
    ]);
  }

  async delete(id: MovementId): Promise<void> {
    await this.db.delete(movements).where(eq(movements.id, id as number));
  }
}
