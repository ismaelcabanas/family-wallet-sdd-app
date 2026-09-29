import type { AccountDTO } from "@/application/movement/dto";
import Link from "next/link";

export function accountCardLabel(account: AccountDTO): string {
  return account.type === "shared"
    ? "Cuenta común"
    : `Cuenta personal de ${account.memberName ?? "miembro"}`;
}

export function AccountCardGrid({ accounts }: { accounts: AccountDTO[] }) {
  return (
    <ul aria-label="Cuentas" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {accounts.map((account) => (
        <li key={account.id}>
          <Link
            href={`/accounts/${account.id}`}
            className="flex flex-col gap-1 rounded-lg border bg-card p-4 text-card-foreground transition-colors hover:bg-accent"
          >
            <span className="text-lg font-semibold">{account.name}</span>
            <span className="text-sm text-muted-foreground">
              {accountCardLabel(account)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
