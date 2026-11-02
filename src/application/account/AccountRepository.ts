import type { AccountId } from "@/domain/account/AccountId";
import type { Account } from "@/domain/account/Account";

import type { AccountDTO } from "../movement/dto";

export interface AccountRepository {
  findAll(): Promise<AccountDTO[]>;
  findById(id: AccountId): Promise<Account | null>;
  findByName(name: string): Promise<Account | null>;
  update(account: Account): Promise<Account>;
}
