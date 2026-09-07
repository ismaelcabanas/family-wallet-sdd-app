import type { ExpenseNature } from "@/domain/movement/ExpenseNature";
import type { MovementType } from "@/domain/movement/MovementType";

export interface CreateMovementDTO {
  accountId: number;
  type: MovementType;
  date: string;
  concept: string;
  description: string | null;
  amountCents: number;
  nature: ExpenseNature | null;
  tagIds: number[];
}

export interface MovementTagDTO {
  id: number;
  name: string;
  slug: string;
}

export interface MovementDTO {
  id: number;
  accountId: number;
  type: MovementType;
  date: string;
  concept: string;
  description: string | null;
  amountCents: number;
  nature: ExpenseNature | null;
  tags: MovementTagDTO[];
}

export interface AccountDTO {
  id: number;
  name: string;
  type: "personal" | "shared";
  memberName: string | null;
}

export interface TagDTO {
  id: number;
  name: string;
  slug: string;
}
