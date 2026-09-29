import { ListAccounts } from "@/application/account/ListAccounts";
import { connection } from "next/server";

import { db } from "@/infrastructure/db/client";
import { DrizzleAccountRepository } from "@/infrastructure/db/DrizzleAccountRepository";
import { AccountCardGrid } from "@/infrastructure/primary/ui/account-card-grid";
import { GlobalNav } from "@/infrastructure/primary/ui/global-nav";

export default async function Home() {
  await connection();

  const accounts = await new ListAccounts(new DrizzleAccountRepository(db)).execute();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Family Wallet</h1>
        <GlobalNav active="panel" />
      </div>

      <AccountCardGrid accounts={accounts} />
    </main>
  );
}
