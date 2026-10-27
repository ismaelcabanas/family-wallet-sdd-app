import { DomainError } from "../shared/DomainError";

export type SavingsAllocationField = "percentage" | "activatedAtMonth";

export class InvalidSavingsAllocationError extends DomainError {
  constructor(
    readonly field: SavingsAllocationField,
    message: string,
  ) {
    super(message);
  }
}

export class SharedAccountSavingsError extends DomainError {
  constructor(message = "La cuenta común no puede tener ahorro.") {
    super(message);
  }
}

export class SavingsAllocationNotFoundError extends DomainError {
  constructor(message = "No existe ahorro configurado para esta cuenta.") {
    super(message);
  }
}

export class MissingRegularIncomeError extends DomainError {
  constructor(message = "Configura primero el ingreso regular de este miembro.") {
    super(message);
  }
}
