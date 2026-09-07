import type { AccountDTO } from "../movement/dto";
import type { AccountRepository } from "./AccountRepository";

export class ListAccounts {
  constructor(private readonly accounts: AccountRepository) {}

  async execute(): Promise<AccountDTO[]> {
    return this.accounts.findAll();
  }
}
