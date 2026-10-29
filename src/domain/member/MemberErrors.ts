import { DomainError } from "../shared/DomainError";

export class InvalidMemberError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}

export class DuplicateMemberNameError extends DomainError {
  constructor(name: string) {
    super(`Ya existe un miembro con el nombre "${name}".`);
  }
}

export class MemberNotFoundError extends DomainError {
  constructor(message = "El miembro seleccionado no existe.") {
    super(message);
  }
}
