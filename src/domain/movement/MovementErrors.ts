import { DomainError } from "../shared/DomainError";

export class InvalidMoneyError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}

export type MovementField =
  | "date"
  | "concept"
  | "amount"
  | "accountId"
  | "type"
  | "nature"
  | "tagIds";

export class InvalidMovementError extends DomainError {
  constructor(
    readonly field: MovementField,
    message: string,
  ) {
    super(message);
  }
}

export class MovementNotFoundError extends DomainError {
  constructor(message = "El movimiento ya no existe.") {
    super(message);
  }
}
