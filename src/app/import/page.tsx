import { ListAccounts } from "@/application/account/ListAccounts";
import { connection } from "next/server";

import { db } from "@/infrastructure/db/client";
import { DrizzleAccountRepository } from "@/infrastructure/db/DrizzleAccountRepository";
import { buildMonthWindow, currentMonth } from "@/infrastructure/primary/ui/format";
import { GlobalNav } from "@/infrastructure/primary/ui/global-nav";
import { ImportSheetWizard } from "@/infrastructure/primary/ui/import-sheet-wizard";

export default async function ImportPage() {
  await connection();

  const accounts = await new ListAccounts(new DrizzleAccountRepository(db)).execute();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Importar hoja mensual</h1>
        <GlobalNav active="import" />
      </div>

      <ImportSheetWizard accounts={accounts} months={buildMonthWindow(currentMonth(), 24)} />
    </main>
  );
}
