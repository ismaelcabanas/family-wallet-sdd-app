import { AccountId } from "../account/AccountId";
import { TagId } from "../tag/TagId";
import { ExpenseNature } from "./ExpenseNature";
import { MovementId } from "./MovementId";
import { InvalidMovementError } from "./MovementErrors";
import { Money } from "./Money";
import { MovementType } from "./MovementType";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isRealCalendarDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export interface MovementInput {
  accountId: AccountId;
  type: MovementType;
  date: string;
  concept: string;
  description: string | null;
  amount: Money;
  nature: ExpenseNature | null;
  tagIds: TagId[];
}

export interface MovementPersistence {
  id: number;
  accountId: AccountId;
  type: MovementType;
  date: string;
  concept: string;
  description: string | null;
  amount: Money;
  nature: ExpenseNature | null;
  tagIds: TagId[];
  createdAt: string;
}

export class Movement {
  readonly id: MovementId | null;
  readonly accountId: AccountId;
  readonly type: MovementType;
  readonly date: string;
  readonly concept: string;
  readonly description: string | null;
  readonly amount: Money;
  readonly nature: ExpenseNature | null;
  readonly tagIds: readonly TagId[];
  readonly createdAt: string;

  private constructor(
    id: MovementId | null,
    accountId: AccountId,
    type: MovementType,
    date: string,
    concept: string,
    description: string | null,
    amount: Money,
    nature: ExpenseNature | null,
    tagIds: TagId[],
    createdAt: string,
  ) {
    this.id = id;
    this.accountId = accountId;
    this.type = type;
    this.date = date;
    this.concept = concept;
    this.description = description;
    this.amount = amount;
    this.nature = nature;
    this.tagIds = Object.freeze([...tagIds]);
    this.createdAt = createdAt;
    Object.freeze(this);
  }

  static create(input: MovementInput): Movement {
    const concept = input.concept.trim();
    if (concept === "") {
      throw new InvalidMovementError("concept", "El concepto es obligatorio.");
    }

    if (!isRealCalendarDate(input.date)) {
      throw new InvalidMovementError("date", "Indica una fecha válida.");
    }

    if (input.amount.amountCents <= 0) {
      throw new InvalidMovementError("amount", "El importe debe ser mayor que cero.");
    }

    if (input.type === "expense") {
      if (input.nature === null) {
        throw new InvalidMovementError(
          "nature",
          "Selecciona la naturaleza del gasto (personal o compartido).",
        );
      }
    } else if (input.nature !== null) {
      throw new InvalidMovementError("nature", "Los ingresos no llevan naturaleza.");
    }

    const uniqueTagIds = [...new Set(input.tagIds)];
    if (uniqueTagIds.length === 0) {
      throw new InvalidMovementError("tagIds", "Selecciona al menos una etiqueta.");
    }

    return new Movement(
      null,
      input.accountId,
      input.type,
      input.date,
      concept,
      input.description?.trim() === "" ? null : (input.description?.trim() ?? null),
      input.amount,
      input.nature,
      uniqueTagIds,
      new Date().toISOString(),
    );
  }

  static rehydrate(persistence: MovementPersistence): Movement {
    return new Movement(
      MovementId(persistence.id),
      persistence.accountId,
      persistence.type,
      persistence.date,
      persistence.concept,
      persistence.description,
      persistence.amount,
      persistence.nature,
      persistence.tagIds,
      persistence.createdAt,
    );
  }
}
