import { AccountId } from "@/domain/account/AccountId";
import { ExpenseNature } from "@/domain/movement/ExpenseNature";
import { Money } from "@/domain/movement/Money";
import { Movement } from "@/domain/movement/Movement";
import { MovementType } from "@/domain/movement/MovementType";
import { TagId } from "@/domain/tag/TagId";

import type { MovementDTO } from "@/application/movement/dto";
import type { MovementRow, NewMovementRow } from "../schema/movements";
import type { TagRow } from "../schema/tags";

export function mapMovementToRow(movement: Movement): NewMovementRow {
  return {
    accountId: movement.accountId as number,
    type: movement.type,
    date: movement.date,
    concept: movement.concept,
    description: movement.description,
    amountCents: movement.amount.amountCents,
    nature: movement.nature,
    createdAt: movement.createdAt,
  };
}

export interface MovementWithTagsRow extends MovementRow {
  tags: Array<Pick<TagRow, "id" | "name" | "slug">>;
}

export function mapJoinedRowsToMovementDTOs(
  rows: Array<
    MovementRow & { tagId: number | null; tagName: string | null; tagSlug: string | null }
  >,
): MovementDTO[] {
  const movementsById = new Map<number, MovementDTO>();

  for (const row of rows) {
    let dto = movementsById.get(row.id);
    if (!dto) {
      dto = {
        id: row.id,
        accountId: row.accountId,
        type: row.type as MovementType,
        date: row.date,
        concept: row.concept,
        description: row.description,
        amountCents: row.amountCents,
        nature: row.nature as ExpenseNature | null,
        tags: [],
      };
      movementsById.set(row.id, dto);
    }
    if (row.tagId !== null && row.tagName !== null && row.tagSlug !== null) {
      dto.tags.push({ id: row.tagId, name: row.tagName, slug: row.tagSlug });
    }
  }

  return [...movementsById.values()];
}

export function mapRowToMovement(row: MovementRow, tagIds: number[]): Movement {
  return Movement.rehydrate({
    id: row.id,
    accountId: AccountId(row.accountId),
    type: row.type as MovementType,
    date: row.date,
    concept: row.concept,
    description: row.description,
    amount: Money.fromCents(row.amountCents),
    nature: row.nature as ExpenseNature | null,
    tagIds: tagIds.map((id) => TagId(id)),
    createdAt: row.createdAt,
  });
}
