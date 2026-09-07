import type { MovementDTO } from "@/application/movement/dto";
import type { MovementRepository } from "@/application/movement/MovementRepository";
import { AccountId } from "@/domain/account/AccountId";
import { Movement } from "@/domain/movement/Movement";
import { MovementId } from "@/domain/movement/MovementId";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

import { mapJoinedRowsToMovementDTOs, mapMovementToRow } from "./mappers/movement.mapper";
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
}
