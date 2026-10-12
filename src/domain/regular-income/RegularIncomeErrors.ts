import { DomainError } from "../shared/DomainError";

export type RegularIncomeField = "dayOfMonth" | "note" | "activatedAtMonth";

export class InvalidRegularIncomeError extends DomainError {
  constructor(
    readonly field: RegularIncomeField,
    message: string,
  ) {
    super(message);
  }
}

export class SharedAccountIncomeError extends DomainError {
  constructor(message = "La cuenta común no puede tener ingreso regular.") {
    super(message);
  }
}

export class RegularIncomeNotFoundError extends DomainError {
  constructor(message = "No existe ingreso regular para esta cuenta.") {
    super(message);
  }
}
