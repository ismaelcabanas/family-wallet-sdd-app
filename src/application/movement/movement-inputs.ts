import type { Account } from "@/domain/account/Account";
import type { ExpenseNature } from "@/domain/movement/ExpenseNature";
import type { MovementType } from "@/domain/movement/MovementType";
import { InvalidMovementError } from "@/domain/movement/MovementErrors";
import { TagId } from "@/domain/tag/TagId";
import { InactiveTagError, TagNotFoundError } from "@/domain/tag/TagErrors";

import type { TagRepository } from "../tag/TagRepository";

export const DEFAULT_TAG_SLUG = "sin-clasificar";

export interface MovementNatureInput {
  type: MovementType;
  nature: ExpenseNature | null;
}

export function resolveNature(
  dto: MovementNatureInput,
  account: Pick<Account, "type">,
): ExpenseNature | null {
  if (dto.type === "income") {
    if (dto.nature !== null) {
      throw new InvalidMovementError("nature", "Los ingresos no llevan naturaleza.");
    }
    return null;
  }
  if (dto.nature !== null) {
    return dto.nature;
  }
  if (account.type === "shared") {
    return "shared";
  }
  throw new InvalidMovementError(
    "nature",
    "Selecciona la naturaleza del gasto (personal o compartido).",
  );
}

export async function resolveTagIds(
  tags: TagRepository,
  rawTagIds: number[],
): Promise<TagId[]> {
  const uniqueIds = [...new Set(rawTagIds)];

  if (uniqueIds.length === 0) {
    const defaultTag = await tags.findBySlug(DEFAULT_TAG_SLUG);
    if (!defaultTag || defaultTag.status !== "active" || defaultTag.id === null) {
      throw new TagNotFoundError();
    }
    return [defaultTag.id];
  }

  const tagIds = uniqueIds.map((id) => TagId(id));
  const found = await tags.findByIds(tagIds);
  if (found.length !== tagIds.length) {
    throw new TagNotFoundError();
  }
  if (found.some((tag) => tag.status !== "active")) {
    throw new InactiveTagError();
  }
  return tagIds;
}
