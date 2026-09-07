import { DomainError } from "../shared/DomainError";

export class InvalidAccountError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}

export class AccountNotFoundError extends DomainError {
  constructor(message = "La cuenta seleccionada no existe.") {
    super(message);
  }
}
