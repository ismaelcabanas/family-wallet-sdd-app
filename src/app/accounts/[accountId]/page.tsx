import { ListAccounts } from "@/application/account/ListAccounts";
import { GetMonthlyClosure } from "@/application/movement/GetMonthlyClosure";
import { ListMovements } from "@/application/movement/ListMovements";
import { ListActiveTags } from "@/application/tag/ListActiveTags";
import { AccountId } from "@/domain/account/AccountId";
import { notFound } from "next/navigation";
import { z } from "zod";

import { db } from "@/infrastructure/db/client";
import { DrizzleAccountRepository } from "@/infrastructure/db/DrizzleAccountRepository";
import { DrizzleMovementRepository } from "@/infrastructure/db/DrizzleMovementRepository";
import { DrizzleTagRepository } from "@/infrastructure/db/DrizzleTagRepository";
import { AccountBalance } from "@/infrastructure/primary/ui/account-balance";
import { GlobalNav } from "@/infrastructure/primary/ui/global-nav";
import { GroupedMovementList } from "@/infrastructure/primary/ui/grouped-movement-list";
import { currentMonth, monthEndIsoDate, monthLabel } from "@/infrastructure/primary/ui/format";
import { MonthStepper } from "@/infrastructure/primary/ui/month-stepper";
import { MonthlyClosurePanel } from "@/infrastructure/primary/ui/monthly-closure-panel";
import { MovementForm } from "@/infrastructure/primary/ui/movement-form";

const accountIdParamSchema = z
  .string()
  .regex(/^\d+$/)
  .transform(Number);
const monthParamSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ accountId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { accountId: rawAccountId } = await params;
  const query = await searchParams;

  const accountRepository = new DrizzleAccountRepository(db);
  const movementRepository = new DrizzleMovementRepository(db);
  const tagRepository = new DrizzleTagRepository(db);

  const accounts = await new ListAccounts(accountRepository).execute();

  const parsedAccountId = accountIdParamSchema.safeParse(rawAccountId);
  const account = parsedAccountId.success
    ? accounts.find((candidate) => candidate.id === parsedAccountId.data)
    : undefined;

  if (account === undefined) {
    notFound();
  }

  const parsedMonth = monthParamSchema.safeParse(firstParam(query.month));
  const month = parsedMonth.success ? parsedMonth.data : currentMonth();

  const [movements, balanceCents, tags, closure] = await Promise.all([
    new ListMovements(movementRepository).execute(account.id, month),
    accountRepository.getBalance(AccountId(account.id), monthEndIsoDate(month)),
    new ListActiveTags(tagRepository).execute(),
    new GetMonthlyClosure(movementRepository).execute(account.id, month),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{account.name}</h1>
        <GlobalNav active="panel" month={month} />
      </div>
      <p className="text-sm text-muted-foreground">
        {account.type === "shared"
          ? "Cuenta común"
          : `Cuenta personal de ${account.memberName ?? "miembro"}`}
      </p>

      <MonthStepper accountId={account.id} month={month} />

      <AccountBalance
        accountName={account.name}
        balanceCents={balanceCents}
        subtitle={`Acumulado hasta ${monthLabel(month)}`}
      />

      <MovementForm
        accountId={account.id}
        accountName={account.name}
        accountType={account.type}
        tags={tags}
      />

      <MonthlyClosurePanel closure={closure} month={month} />

      <GroupedMovementList
        movements={movements}
        accounts={accounts}
        tags={tags}
        currentAccountId={account.id}
        currentMonth={month}
      />
    </main>
  );
}
