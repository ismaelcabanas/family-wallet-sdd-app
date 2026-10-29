import { MemberId } from "../member/MemberId";
import { AccountId } from "./AccountId";
import { AccountType } from "./AccountType";
import { AccountNotRenamableError, InvalidAccountError } from "./AccountErrors";

export interface AccountInput {
  name: string | null;
  type: AccountType;
  memberId: MemberId | null;
}

export class Account {
  readonly id: AccountId | null;
  readonly name: string | null;
  readonly type: AccountType;
  readonly memberId: MemberId | null;

  private constructor(
    id: AccountId | null,
    name: string | null,
    type: AccountType,
    memberId: MemberId | null,
  ) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.memberId = memberId;
    Object.freeze(this);
  }

  static create(input: AccountInput): Account {
    if (input.type === "personal" && input.name !== null) {
      throw new InvalidAccountError(
        "Las cuentas personales no tienen nombre propio: se deriva del miembro.",
      );
    }
    const name = input.type === "shared" && input.name !== null ? input.name.trim() : null;
    if (input.type === "shared" && name === null) {
      throw new InvalidAccountError("El nombre de la cuenta es obligatorio.");
    }
    if (input.type === "shared" && name === "") {
      throw new InvalidAccountError("El nombre de la cuenta es obligatorio.");
    }
    if (input.type === "personal" && input.memberId === null) {
      throw new InvalidAccountError("Una cuenta personal debe atribuirse a un miembro.");
    }
    if (input.type === "shared" && input.memberId !== null) {
      throw new InvalidAccountError("La cuenta común no se atribuye a ningún miembro.");
    }
    return new Account(null, name, input.type, input.memberId);
  }

  static rehydrate(
    id: number,
    name: string | null,
    type: AccountType,
    memberId: MemberId | null,
  ): Account {
    return new Account(AccountId(id), name, type, memberId);
  }

  rename(name: string): Account {
    if (this.type === "personal") {
      throw new AccountNotRenamableError();
    }
    const trimmed = name.trim();
    if (trimmed === "") {
      throw new InvalidAccountError("El nombre de la cuenta es obligatorio.");
    }
    return new Account(this.id, trimmed, this.type, this.memberId);
  }
}
