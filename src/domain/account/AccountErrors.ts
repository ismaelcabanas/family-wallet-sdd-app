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

export class DuplicateAccountNameError extends DomainError {
  constructor(name: string) {
    super(`Ya existe una cuenta con el nombre "${name}".`);
  }
}

export class AccountNotRenamableError extends DomainError {
  constructor(
    message = "Las cuentas personales no se renombran: su nombre se deduce del miembro.",
  ) {
    super(message);
  }
}
