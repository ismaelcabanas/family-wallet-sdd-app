import { DomainError } from "../shared/DomainError";

export class InvalidCategoryError extends DomainError {
  constructor(message = "El nombre de la categoría es obligatorio.") {
    super(message);
  }
}

export class DuplicateCategoryNameError extends DomainError {
  constructor(name: string) {
    super(`Ya existe una categoría con el nombre "${name}".`);
  }
}

export class CategoryNotFoundError extends DomainError {
  constructor(message = "La categoría seleccionada ya no está disponible.") {
    super(message);
  }
}

export class ProtectedCategoryError extends DomainError {
  constructor(name: string) {
    super(`La categoría "${name}" es la categoría por defecto y no puede eliminarse.`);
  }
}

export class CategoryNotEmptyError extends DomainError {
  constructor(name: string) {
    super(
      `La categoría "${name}" tiene etiquetas asignadas. Muévelas a otra categoría antes de eliminarla.`,
    );
  }
}
