import { GetAnnualIncomeStatement } from "@/application/movement/GetAnnualIncomeStatement";
import { z } from "zod";

import { db } from "@/infrastructure/db/client";
import { DrizzleAccountRepository } from "@/infrastructure/db/DrizzleAccountRepository";
import { DrizzleMemberRepository } from "@/infrastructure/db/DrizzleMemberRepository";
import { DrizzleMovementRepository } from "@/infrastructure/db/DrizzleMovementRepository";
import { AnnualStatementPanel } from "@/infrastructure/primary/ui/annual-statement-panel";
import { currentYear } from "@/infrastructure/primary/ui/format";
import { GlobalNav } from "@/infrastructure/primary/ui/global-nav";
import { YearSelector } from "@/infrastructure/primary/ui/year-selector";

const yearParamSchema = z.string().regex(/^\d{4}$/);

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AnnualStatementPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;

  const parsedYear = yearParamSchema.safeParse(firstParam(params.year));
  const year = parsedYear.success ? parsedYear.data : currentYear();

  const statement = await new GetAnnualIncomeStatement(
    new DrizzleMovementRepository(db),
    new DrizzleAccountRepository(db),
    new DrizzleMemberRepository(db),
  ).execute(year);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Family Wallet</h1>
        <GlobalNav active="annual" month={`${year}-01`} />
      </div>

      <YearSelector year={year} />

      <AnnualStatementPanel statement={statement} year={year} />
    </main>
  );
}
