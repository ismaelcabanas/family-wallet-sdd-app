"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import type { AccountDTO } from "@/application/movement/dto";

import { buildMonthWindow, monthLabel } from "./format";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";

const MONTH_RADIUS = 24;

export function AccountMonthSelector({
  accounts,
  activeAccountId,
  month,
}: {
  accounts: AccountDTO[];
  activeAccountId: number;
  month: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const activeAccount = accounts.find((account) => account.id === activeAccountId);
  const months = buildMonthWindow(month, MONTH_RADIUS);

  const navigate = (nextAccountId: number, nextMonth: string) => {
    startTransition(() => {
      router.replace(`/?account=${nextAccountId}&month=${nextMonth}`);
    });
  };

  return (
    <section
      aria-label="Selección de cuenta y mes"
      className={`flex flex-wrap items-center gap-3 ${isPending ? "opacity-60" : ""}`}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="account-selector" className="text-sm font-medium">
          Cuenta
        </label>
        <Select
          value={String(activeAccountId)}
          onValueChange={(value) => navigate(Number(value), month)}
        >
          <SelectTrigger id="account-selector" className="w-64" aria-label="Cuenta activa">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((account) => (
              <SelectItem key={account.id} value={String(account.id)}>
                {account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {activeAccount ? (
          <span className="text-xs text-muted-foreground">
            {activeAccount.type === "shared"
              ? "Cuenta común"
              : `Cuenta personal de ${activeAccount.memberName ?? "miembro"}`}
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="month-selector" className="text-sm font-medium">
          Mes
        </label>
        <Select value={month} onValueChange={(value) => navigate(activeAccountId, value)}>
          <SelectTrigger id="month-selector" className="w-48" aria-label="Mes visible">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((option) => (
              <SelectItem key={option} value={option}>
                {monthLabel(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </section>
  );
}
