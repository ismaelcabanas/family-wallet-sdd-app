import type { AccountDTO } from "@/application/movement/dto";
import type { AccountRepository } from "@/application/account/AccountRepository";
import { AccountId } from "@/domain/account/AccountId";
import { Money } from "@/domain/movement/Money";
import { asc, eq, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

import { mapRowToAccount, mapRowToAccountDTO } from "./mappers/account.mapper";
import { accounts } from "./schema/accounts";
import { members } from "./schema/members";
import { movements } from "./schema/movements";
import type * as schema from "./schema";

export class DrizzleAccountRepository implements AccountRepository {
  constructor(private readonly db: LibSQLDatabase<typeof schema>) {}

  async findAll(): Promise<AccountDTO[]> {
    const rows = await this.db
      .select({
        id: accounts.id,
        name: accounts.name,
        type: accounts.type,
        memberName: members.name,
      })
      .from(accounts)
      .leftJoin(members, eq(members.id, accounts.memberId))
      .orderBy(asc(accounts.id));

    return rows.map(mapRowToAccountDTO);
  }

  async findById(id: AccountId) {
    const rows = await this.db
      .select()
      .from(accounts)
      .where(eq(accounts.id, id as number))
      .limit(1);

    return rows.length > 0 ? mapRowToAccount(rows[0]) : null;
  }

  async getBalance(id: AccountId): Promise<number> {
    const [row] = await this.db
      .select({
        balance: sql<number>`coalesce(sum(case when ${movements.type} = 'income' then ${movements.amountCents} else -${movements.amountCents} end), 0)`,
      })
      .from(movements)
      .where(eq(movements.accountId, id as number));

    return Money.fromCentsOrZero(row?.balance ?? 0).amountCents;
  }
}
