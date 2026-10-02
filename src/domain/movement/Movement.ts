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
  note: string;
  amount: Money;
  nature: ExpenseNature | null;
  tagId: TagId | null;
}

export interface MovementPersistence {
  id: number;
  accountId: AccountId;
  type: MovementType;
  date: string;
  note: string;
  amount: Money;
  nature: ExpenseNature | null;
  tagId: TagId | null;
  createdAt: string;
}

type ValidatedMovementState = [
  accountId: AccountId,
  type: MovementType,
  date: string,
  note: string,
  amount: Money,
  nature: ExpenseNature | null,
  tagId: TagId | null,
];

function buildValidatedState(input: MovementInput): ValidatedMovementState {
  const note = input.note.trim();
  if (note === "") {
    throw new InvalidMovementError("note", "La nota es obligatoria.");
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
    if (input.tagId === null) {
      throw new InvalidMovementError("tagId", "Selecciona una etiqueta para el gasto.");
    }
  } else {
    if (input.nature !== null) {
      throw new InvalidMovementError("nature", "Los ingresos no llevan naturaleza.");
    }
  }

  return [input.accountId, input.type, input.date, note, input.amount, input.nature, input.tagId];
}

export class Movement {
  readonly id: MovementId | null;
  readonly accountId: AccountId;
  readonly type: MovementType;
  readonly date: string;
  readonly note: string;
  readonly amount: Money;
  readonly nature: ExpenseNature | null;
  readonly tagId: TagId | null;
  readonly createdAt: string;

  private constructor(
    id: MovementId | null,
    accountId: AccountId,
    type: MovementType,
    date: string,
    note: string,
    amount: Money,
    nature: ExpenseNature | null,
    tagId: TagId | null,
    createdAt: string,
  ) {
    this.id = id;
    this.accountId = accountId;
    this.type = type;
    this.date = date;
    this.note = note;
    this.amount = amount;
    this.nature = nature;
    this.tagId = tagId;
    this.createdAt = createdAt;
    Object.freeze(this);
  }

  static create(input: MovementInput): Movement {
    return new Movement(null, ...buildValidatedState(input), new Date().toISOString());
  }

  static recreate(id: MovementId, input: MovementInput, createdAt: string): Movement {
    return new Movement(id, ...buildValidatedState(input), createdAt);
  }

  static rehydrate(persistence: MovementPersistence): Movement {
    return new Movement(
      MovementId(persistence.id),
      persistence.accountId,
      persistence.type,
      persistence.date,
      persistence.note,
      persistence.amount,
      persistence.nature,
      persistence.tagId,
      persistence.createdAt,
    );
  }
}
