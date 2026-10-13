"use client";

import { useState } from "react";
import Link from "next/link";
import { EllipsisVerticalIcon } from "lucide-react";

import type { AccountDTO } from "@/application/movement/dto";
import type { RegularIncomeDTO } from "@/application/regular-income/dto";

import { RegularIncomeConfigDialog } from "./regular-income-config-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./components/ui/dropdown-menu";

export function accountCardLabel(account: AccountDTO): string {
  return account.type === "shared"
    ? "Cuenta común"
    : `Cuenta personal de ${account.memberName ?? "miembro"}`;
}

export function regularIncomeMenuStatus(config: RegularIncomeDTO | null): string {
  if (config === null) return "Sin configurar";
  return config.active ? "Activa" : "Desactivada";
}

interface AccountCardGridProps {
  accounts: AccountDTO[];
  regularIncomes: Record<number, RegularIncomeDTO | null>;
}

export function AccountCardGrid({ accounts, regularIncomes }: AccountCardGridProps) {
  return (
    <ul aria-label="Cuentas" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {accounts.map((account) => (
        <li key={account.id}>
          <div className="relative flex flex-col gap-1 rounded-lg border bg-card p-4 text-card-foreground transition-colors hover:bg-accent">
            <Link
              href={`/accounts/${account.id}`}
              className="flex flex-col gap-1 after:absolute after:inset-0 after:rounded-lg"
            >
              <span className="text-lg font-semibold">{account.name}</span>
              <span className="text-sm text-muted-foreground">{accountCardLabel(account)}</span>
            </Link>
            {account.type === "personal" ? (
              <AccountSettingsMenu
                account={account}
                config={regularIncomes[account.id] ?? null}
              />
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function AccountSettingsMenu({
  account,
  config,
}: {
  account: AccountDTO;
  config: RegularIncomeDTO | null;
}) {
  const [configOpen, setConfigOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Configuración de ${account.name}`}
          className="absolute top-2 right-2 z-10 inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <EllipsisVerticalIcon className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setConfigOpen(true)} className="gap-4">
            <span>Ingreso regular</span>
            <span className="ml-auto text-muted-foreground">
              {regularIncomeMenuStatus(config)}
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {configOpen ? (
        <RegularIncomeConfigDialog
          accountId={account.id}
          memberName={account.memberName}
          config={config}
          onClose={() => setConfigOpen(false)}
        />
      ) : null}
    </>
  );
}
