import { DomainError } from "../shared/DomainError";

export class InvalidMemberError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}
