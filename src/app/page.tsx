import { ListAccounts } from "@/application/account/ListAccounts";
import { ListMovements } from "@/application/movement/ListMovements";
import { ListActiveTags } from "@/application/tag/ListActiveTags";
import { AccountId } from "@/domain/account/AccountId";
import { z } from "zod";

import { db } from "@/infrastructure/db/client";
import { DrizzleAccountRepository } from "@/infrastructure/db/DrizzleAccountRepository";
import { DrizzleMovementRepository } from "@/infrastructure/db/DrizzleMovementRepository";
import { DrizzleTagRepository } from "@/infrastructure/db/DrizzleTagRepository";
import { AccountMonthSelector } from "@/infrastructure/primary/ui/account-month-selector";
import { AccountBalance } from "@/infrastructure/primary/ui/account-balance";
import { EmptyState } from "@/infrastructure/primary/ui/empty-state";
import { currentMonth } from "@/infrastructure/primary/ui/format";
import { MovementForm } from "@/infrastructure/primary/ui/movement-form";
import { MovementList } from "@/infrastructure/primary/ui/movement-list";

const accountParamSchema = z
  .string()
  .regex(/^\d+$/)
  .transform(Number);
const monthParamSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;

  const accountRepository = new DrizzleAccountRepository(db);
  const movementRepository = new DrizzleMovementRepository(db);
  const tagRepository = new DrizzleTagRepository(db);

  const accounts = await new ListAccounts(accountRepository).execute();

  const parsedAccountId = accountParamSchema.safeParse(firstParam(params.account));
  const activeAccount =
    (parsedAccountId.success
      ? accounts.find((account) => account.id === parsedAccountId.data)
      : undefined) ??
    accounts.find((account) => account.type === "personal") ??
    accounts[0];

  const parsedMonth = monthParamSchema.safeParse(firstParam(params.month));
  const month = parsedMonth.success ? parsedMonth.data : currentMonth();

  const [movements, balanceCents, tags] = await Promise.all([
    new ListMovements(movementRepository).execute(activeAccount.id, month),
    accountRepository.getBalance(AccountId(activeAccount.id)),
    new ListActiveTags(tagRepository).execute(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">Family Wallet</h1>

      <AccountMonthSelector
        accounts={accounts}
        activeAccountId={activeAccount.id}
        month={month}
      />

      <AccountBalance accountName={activeAccount.name} balanceCents={balanceCents} />

      <MovementForm
        accountId={activeAccount.id}
        accountName={activeAccount.name}
        accountType={activeAccount.type}
        tags={tags}
      />

      {movements.length === 0 ? <EmptyState /> : <MovementList movements={movements} />}
    </main>
  );
}
