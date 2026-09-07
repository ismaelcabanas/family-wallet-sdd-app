import { MemberId } from "../member/MemberId";
import { AccountId } from "./AccountId";
import { AccountType } from "./AccountType";
import { InvalidAccountError } from "./AccountErrors";

export interface AccountInput {
  name: string;
  type: AccountType;
  memberId: MemberId | null;
}

export class Account {
  readonly id: AccountId | null;
  readonly name: string;
  readonly type: AccountType;
  readonly memberId: MemberId | null;

  private constructor(
    id: AccountId | null,
    name: string,
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
    const name = input.name.trim();
    if (name === "") {
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
    name: string,
    type: AccountType,
    memberId: MemberId | null,
  ): Account {
    return new Account(AccountId(id), name, type, memberId);
  }
}
