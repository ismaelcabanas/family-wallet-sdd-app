import { ListAccounts } from "@/application/account/ListAccounts";
import { GetRegularIncome } from "@/application/regular-income/GetRegularIncome";
import { connection } from "next/server";

import { db } from "@/infrastructure/db/client";
import { DrizzleAccountRepository } from "@/infrastructure/db/DrizzleAccountRepository";
import { DrizzleRegularIncomeRepository } from "@/infrastructure/db/DrizzleRegularIncomeRepository";
import { AccountCardGrid } from "@/infrastructure/primary/ui/account-card-grid";
import { GlobalNav } from "@/infrastructure/primary/ui/global-nav";
import { AccountId } from "@/domain/account/AccountId";
import type { RegularIncomeDTO } from "@/application/regular-income/dto";

export default async function Home() {
  await connection();

  const accountRepository = new DrizzleAccountRepository(db);
  const regularIncomeRepository = new DrizzleRegularIncomeRepository(db);

  const accounts = await new ListAccounts(accountRepository).execute();

  const regularIncomes: Record<number, RegularIncomeDTO | null> = {};
  for (const account of accounts) {
    if (account.type !== "personal") continue;
    regularIncomes[account.id] = await new GetRegularIncome(regularIncomeRepository).execute(
      AccountId(account.id),
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Family Wallet</h1>
        <GlobalNav active="panel" />
      </div>

      <AccountCardGrid accounts={accounts} regularIncomes={regularIncomes} />
    </main>
  );
}
