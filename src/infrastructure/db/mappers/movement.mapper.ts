import { AccountId } from "@/domain/account/AccountId";
import { ExpenseNature } from "@/domain/movement/ExpenseNature";
import { Money } from "@/domain/movement/Money";
import { Movement } from "@/domain/movement/Movement";
import { MovementType } from "@/domain/movement/MovementType";
import { TagId } from "@/domain/tag/TagId";

import type { MovementDTO } from "@/application/movement/dto";
import type { MovementRow, NewMovementRow } from "../schema/movements";

export function mapMovementToRow(movement: Movement): NewMovementRow {
  return {
    accountId: movement.accountId as number,
    type: movement.type,
    date: movement.date,
    note: movement.note,
    amountCents: movement.amount.amountCents,
    nature: movement.nature,
    tagId: movement.tagId as number | null,
    createdAt: movement.createdAt,
  };
}

export interface MovementJoinedRow
  extends Pick<
    MovementRow,
    "id" | "accountId" | "type" | "date" | "note" | "amountCents" | "nature"
  > {
  tagId: number | null;
  tagName: string | null;
  tagSlug: string | null;
}

export function mapJoinedRowToMovementDTO(row: MovementJoinedRow): MovementDTO {
  const { tagId, tagName, tagSlug } = row;
  const hasTag = tagId !== null && tagName !== null && tagSlug !== null;
  return {
    id: row.id,
    accountId: row.accountId,
    type: row.type as MovementType,
    date: row.date,
    note: row.note,
    amountCents: row.amountCents,
    nature: row.nature as ExpenseNature | null,
    tag: hasTag ? { id: tagId, name: tagName, slug: tagSlug } : null,
  };
}

export function mapRowToMovement(row: MovementRow): Movement {
  return Movement.rehydrate({
    id: row.id,
    accountId: AccountId(row.accountId),
    type: row.type as MovementType,
    date: row.date,
    note: row.note,
    amount: Money.fromCents(row.amountCents),
    nature: row.nature as ExpenseNature | null,
    tagId: row.tagId === null ? null : TagId(row.tagId),
    createdAt: row.createdAt,
  });
}
