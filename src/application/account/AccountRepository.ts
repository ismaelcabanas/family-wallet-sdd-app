import type { AccountId } from "@/domain/account/AccountId";
import type { Account } from "@/domain/account/Account";

import type { AccountDTO } from "../movement/dto";

export interface AccountRepository {
  findAll(): Promise<AccountDTO[]>;
  findById(id: AccountId): Promise<Account | null>;
  getBalance(id: AccountId): Promise<number>;
}
