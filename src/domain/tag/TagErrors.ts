import { DomainError } from "../shared/DomainError";

export class InvalidTagError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}

export class DuplicateTagNameError extends DomainError {
  constructor(name: string) {
    super(`Ya existe una etiqueta con el nombre "${name}".`);
  }
}

export class InactiveTagError extends DomainError {
  constructor(message = "Una de las etiquetas seleccionadas ya no está disponible.") {
    super(message);
  }
}

export class TagNotFoundError extends DomainError {
  constructor(message = "Una de las etiquetas seleccionadas ya no está disponible.") {
    super(message);
  }
}
