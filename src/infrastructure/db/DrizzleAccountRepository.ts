import type { AccountDTO } from "@/application/movement/dto";
import type { AccountRepository } from "@/application/account/AccountRepository";
import { DuplicateAccountNameError } from "@/domain/account/AccountErrors";
import { AccountId } from "@/domain/account/AccountId";
import type { Account } from "@/domain/account/Account";
import { Money } from "@/domain/movement/Money";
import { and, asc, eq, lte, sql } from "drizzle-orm";
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
        memberId: accounts.memberId,
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

  async findByName(name: string): Promise<Account | null> {
    const rows = await this.db
      .select()
      .from(accounts)
      .where(sql`lower(${accounts.name}) = lower(${name})`)
      .limit(1);
    return rows.length > 0 ? mapRowToAccount(rows[0]) : null;
  }

  async update(account: Account): Promise<Account> {
    if (account.id === null) {
      throw new RangeError("update requiere una cuenta persistida");
    }
    try {
      const rows = await this.db
        .update(accounts)
        .set({ name: account.name })
        .where(eq(accounts.id, account.id))
        .returning();
      return mapRowToAccount(rows[0]);
    } catch (error) {
      throw this.translateUniqueViolation(error, account);
    }
  }

  async getBalance(id: AccountId, asOf?: string): Promise<number> {
    const [row] = await this.db
      .select({
        balance: sql<number>`coalesce(sum(case when ${movements.type} = 'income' then ${movements.amountCents} else -${movements.amountCents} end), 0)`,
      })
      .from(movements)
      .where(
        asOf !== undefined
          ? and(eq(movements.accountId, id as number), lte(movements.date, asOf))
          : eq(movements.accountId, id as number),
      );

    return Money.fromCentsOrZero(row?.balance ?? 0).amountCents;
  }

  private translateUniqueViolation(error: unknown, account: Account): Error {
    const messages = [
      error instanceof Error ? error.message : "",
      error instanceof Error && error.cause instanceof Error ? error.cause.message : "",
    ];
    if (messages.some((message) => message.includes("accounts_name_nocase_uq"))) {
      return new DuplicateAccountNameError(account.name ?? "");
    }
    return error as Error;
  }
}
