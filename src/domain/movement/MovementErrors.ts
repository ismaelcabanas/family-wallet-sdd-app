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
