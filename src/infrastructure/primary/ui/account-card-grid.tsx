"use client";

import { useState } from "react";
import Link from "next/link";
import { EllipsisVerticalIcon } from "lucide-react";

import type { AccountDTO } from "@/application/movement/dto";
import type { RegularIncomeDTO } from "@/application/regular-income/dto";
import type { CommonContributionDTO } from "@/application/common-contribution/dto";
import type { SavingsAllocationDTO } from "@/application/savings/dto";

import { CommonContributionConfigDialog } from "./common-contribution-config-dialog";
import { RegularIncomeConfigDialog } from "./regular-income-config-dialog";
import { RenameAccountDialog } from "./rename-account-dialog";
import { RenameMemberDialog } from "./rename-member-dialog";
import { SavingsConfigDialog } from "./savings-config-dialog";
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

export function commonContributionMenuStatus(
  contribution: CommonContributionDTO | null,
  regularIncome: RegularIncomeDTO | null,
): "Requiere ingreso regular" | "Sin configurar" | "Activa" | "Desactivada" {
  if (regularIncome === null) return "Requiere ingreso regular";
  if (contribution === null) return "Sin configurar";
  return contribution.active ? "Activa" : "Desactivada";
}

export function savingsMenuStatus(
  savings: SavingsAllocationDTO | null,
  regularIncome: RegularIncomeDTO | null,
): "Requiere ingreso regular" | "Sin configurar" | "Activo" | "Desactivado" {
  if (regularIncome === null) return "Requiere ingreso regular";
  if (savings === null) return "Sin configurar";
  return savings.active ? "Activo" : "Desactivado";
}

interface AccountCardGridProps {
  accounts: AccountDTO[];
  regularIncomes: Record<number, RegularIncomeDTO | null>;
  commonContributions: Record<number, CommonContributionDTO | null>;
  savingsAllocations: Record<number, SavingsAllocationDTO | null>;
}

export function AccountCardGrid({
  accounts,
  regularIncomes,
  commonContributions,
  savingsAllocations,
}: AccountCardGridProps) {
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
                regularIncome={regularIncomes[account.id] ?? null}
                commonContribution={commonContributions[account.id] ?? null}
                savingsAllocation={savingsAllocations[account.id] ?? null}
              />
            ) : (
              <CommonAccountMenu account={account} />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function menuTriggerClass(): string {
  return "absolute top-2 right-2 z-10 inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50";
}

function AccountSettingsMenu({
  account,
  regularIncome,
  commonContribution,
  savingsAllocation,
}: {
  account: AccountDTO;
  regularIncome: RegularIncomeDTO | null;
  commonContribution: CommonContributionDTO | null;
  savingsAllocation: SavingsAllocationDTO | null;
}) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [contributionOpen, setContributionOpen] = useState(false);
  const [savingsOpen, setSavingsOpen] = useState(false);
  const contributionStatus = commonContributionMenuStatus(commonContribution, regularIncome);
  const contributionBlocked = regularIncome === null;
  const savingsStatus = savingsMenuStatus(savingsAllocation, regularIncome);
  const savingsBlocked = regularIncome === null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Configuración de ${account.name}`}
          className={menuTriggerClass()}
        >
          <EllipsisVerticalIcon className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setRenameOpen(true)}>Renombrar miembro</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setConfigOpen(true)} className="gap-4">
            <span>Ingreso regular</span>
            <span className="ml-auto text-muted-foreground">
              {regularIncomeMenuStatus(regularIncome)}
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              if (!contributionBlocked) setContributionOpen(true);
            }}
            disabled={contributionBlocked}
            className="gap-4"
          >
            <span>Aportación</span>
            <span className="ml-auto text-muted-foreground">{contributionStatus}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              if (!savingsBlocked) setSavingsOpen(true);
            }}
            disabled={savingsBlocked}
            className="gap-4"
          >
            <span>Ahorro</span>
            <span className="ml-auto text-muted-foreground">{savingsStatus}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {renameOpen && account.memberId !== null ? (
        <RenameMemberDialog
          memberId={account.memberId}
          memberName={account.memberName ?? "miembro"}
          onClose={() => setRenameOpen(false)}
        />
      ) : null}
      {configOpen ? (
        <RegularIncomeConfigDialog
          accountId={account.id}
          memberName={account.memberName}
          config={regularIncome}
          onClose={() => setConfigOpen(false)}
        />
      ) : null}
      {contributionOpen ? (
        <CommonContributionConfigDialog
          accountId={account.id}
          memberName={account.memberName}
          config={commonContribution}
          onClose={() => setContributionOpen(false)}
        />
      ) : null}
      {savingsOpen ? (
        <SavingsConfigDialog
          accountId={account.id}
          memberName={account.memberName}
          config={savingsAllocation}
          onClose={() => setSavingsOpen(false)}
        />
      ) : null}
    </>
  );
}

function CommonAccountMenu({ account }: { account: AccountDTO }) {
  const [renameOpen, setRenameOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Configuración de ${account.name}`}
          className={menuTriggerClass()}
        >
          <EllipsisVerticalIcon className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setRenameOpen(true)}>Renombrar cuenta</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {renameOpen ? (
        <RenameAccountDialog
          accountId={account.id}
          accountName={account.name}
          onClose={() => setRenameOpen(false)}
        />
      ) : null}
    </>
  );
}
