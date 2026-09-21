import { GetGlobalMonthlySummary } from "@/application/movement/GetGlobalMonthlySummary";
import Link from "next/link";
import { z } from "zod";

import { db } from "@/infrastructure/db/client";
import { DrizzleAccountRepository } from "@/infrastructure/db/DrizzleAccountRepository";
import { DrizzleMovementRepository } from "@/infrastructure/db/DrizzleMovementRepository";
import { GlobalSummaryPanel } from "@/infrastructure/primary/ui/global-summary-panel";
import { currentMonth } from "@/infrastructure/primary/ui/format";
import { MonthSelector } from "@/infrastructure/primary/ui/month-selector";

const monthParamSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function GlobalSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;

  const parsedMonth = monthParamSchema.safeParse(firstParam(params.month));
  const month = parsedMonth.success ? parsedMonth.data : currentMonth();

  const movementRepository = new DrizzleMovementRepository(db);
  const accountRepository = new DrizzleAccountRepository(db);

  const summary = await new GetGlobalMonthlySummary(
    movementRepository,
    accountRepository,
  ).execute(month);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Family Wallet</h1>
        <Link href="/" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          Volver
        </Link>
      </div>

      <MonthSelector month={month} />

      <GlobalSummaryPanel summary={summary} month={month} />
    </main>
  );
}
