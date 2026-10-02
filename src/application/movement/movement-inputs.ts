import type { Account } from "@/domain/account/Account";
import type { ExpenseNature } from "@/domain/movement/ExpenseNature";
import type { MovementType } from "@/domain/movement/MovementType";
import { InvalidMovementError } from "@/domain/movement/MovementErrors";
import { TagId } from "@/domain/tag/TagId";
import { InactiveTagError, TagNotFoundError } from "@/domain/tag/TagErrors";

import type { TagRepository } from "../tag/TagRepository";

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

export async function resolveTagId(
  tags: TagRepository,
  rawTagId: number | null,
): Promise<TagId | null> {
  if (rawTagId === null) {
    return null;
  }

  const tagId = TagId(rawTagId);
  const found = await tags.findByIds([tagId]);
  if (found.length !== 1) {
    throw new TagNotFoundError();
  }
  if (found[0].status !== "active") {
    throw new InactiveTagError();
  }
  return tagId;
}
