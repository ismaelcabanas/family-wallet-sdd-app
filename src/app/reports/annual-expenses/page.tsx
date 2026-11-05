import { GetAnnualCategoryExpenseReport } from "@/application/movement/GetAnnualCategoryExpenseReport";
import { z } from "zod";

import { db } from "@/infrastructure/db/client";
import { DrizzleAccountRepository } from "@/infrastructure/db/DrizzleAccountRepository";
import { DrizzleMovementRepository } from "@/infrastructure/db/DrizzleMovementRepository";
import { DrizzleTagCategoryRepository } from "@/infrastructure/db/DrizzleTagCategoryRepository";
import { DrizzleTagRepository } from "@/infrastructure/db/DrizzleTagRepository";
import { AnnualCategoryExpenseReportTable } from "@/infrastructure/primary/ui/annual-expense-report-table";
import { currentYear } from "@/infrastructure/primary/ui/format";
import { GlobalNav } from "@/infrastructure/primary/ui/global-nav";
import { YearSelector } from "@/infrastructure/primary/ui/year-selector";

const yearParamSchema = z.string().regex(/^\d{4}$/);

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AnnualExpensesReportPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;

  const parsedYear = yearParamSchema.safeParse(firstParam(params.year));
  const year = parsedYear.success ? parsedYear.data : currentYear();

  const report = await new GetAnnualCategoryExpenseReport(
    new DrizzleMovementRepository(db),
    new DrizzleTagRepository(db),
    new DrizzleTagCategoryRepository(db),
    new DrizzleAccountRepository(db),
  ).execute(year);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Family Wallet</h1>
        <GlobalNav active="reports" month={`${year}-01`} />
      </div>

      <YearSelector year={year} basePath="/reports/annual-expenses" />

      <section
        aria-labelledby="annual-expenses-report-title"
        className="rounded-lg border bg-card p-4 text-card-foreground"
      >
        <h2
          id="annual-expenses-report-title"
          className="text-sm font-medium text-muted-foreground"
        >
          Informe anual de gastos de {year}
        </h2>
        <div className="mt-2">
          <AnnualCategoryExpenseReportTable report={report} />
        </div>
      </section>
    </main>
  );
}
