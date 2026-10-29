import {
  AccountNotFoundError,
  DuplicateAccountNameError,
} from "@/domain/account/AccountErrors";
import type { Account } from "@/domain/account/Account";
import type { AccountId } from "@/domain/account/AccountId";

import type { AccountRepository } from "./AccountRepository";

export class RenameAccount {
  constructor(private readonly accounts: AccountRepository) {}

  async execute(input: { id: AccountId; name: string }): Promise<Account> {
    const account = await this.accounts.findById(input.id);
    if (account === null) {
      throw new AccountNotFoundError();
    }

    const renamed = account.rename(input.name);
    const newName = renamed.name ?? "";

    const existing = await this.accounts.findByName(newName);
    if (existing !== null && existing.id !== account.id) {
      throw new DuplicateAccountNameError(newName);
    }

    return this.accounts.update(renamed);
  }
}
