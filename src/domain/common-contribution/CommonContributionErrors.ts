import { DomainError } from "../shared/DomainError";

export type CommonContributionField = "percentage" | "activatedAtMonth";

export class InvalidCommonContributionError extends DomainError {
  constructor(
    readonly field: CommonContributionField,
    message: string,
  ) {
    super(message);
  }
}

export class SharedAccountContributionError extends DomainError {
  constructor(message = "La cuenta común no puede tener aportación.") {
    super(message);
  }
}

export class CommonContributionNotFoundError extends DomainError {
  constructor(message = "No existe aportación configurada para esta cuenta.") {
    super(message);
  }
}

export class MissingRegularIncomeError extends DomainError {
  constructor(message = "Configura primero el ingreso regular de este miembro.") {
    super(message);
  }
}
