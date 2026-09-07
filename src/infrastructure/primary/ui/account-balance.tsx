import { formatAmountCents } from "./format";

export function AccountBalance({
  accountName,
  balanceCents,
}: {
  accountName: string;
  balanceCents: number;
}) {
  const isNegative = balanceCents < 0;

  return (
    <section
      aria-labelledby="account-balance-title"
      className="rounded-lg border bg-card p-4 text-card-foreground"
    >
      <h2 id="account-balance-title" className="text-sm font-medium text-muted-foreground">
        Balance de {accountName}
      </h2>
      <p
        className={`text-3xl font-semibold tabular-nums ${isNegative ? "text-red-600" : "text-foreground"}`}
      >
        {formatAmountCents(balanceCents)}
      </p>
      <p className="text-xs text-muted-foreground">
        Histórico completo de la cuenta (ingresos − gastos)
      </p>
    </section>
  );
}
