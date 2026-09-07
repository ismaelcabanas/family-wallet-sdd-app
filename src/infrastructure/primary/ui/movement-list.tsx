import type { MovementDTO } from "@/application/movement/dto";

import { formatSignedAmountCents } from "./format";

function natureLabel(movement: MovementDTO): string {
  if (movement.type === "income") return "";
  return movement.nature === "shared" ? "Compartido" : "Personal";
}

export function MovementList({ movements }: { movements: MovementDTO[] }) {
  return (
    <section aria-labelledby="movement-list-title">
      <h2 id="movement-list-title" className="mb-2 text-lg font-semibold">
        Movimientos del mes
      </h2>
      <ul className="divide-y rounded-lg border">
        {movements.map((movement) => (
          <li
            key={movement.id}
            className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 p-4"
            data-testid="movement-item"
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="font-medium">{movement.concept}</span>
              {movement.description !== null ? (
                <span className="text-sm text-muted-foreground">{movement.description}</span>
              ) : null}
              <span className="text-xs text-muted-foreground">
                <time dateTime={movement.date}>{movement.date}</time> ·{" "}
                {movement.type === "expense" ? "Gasto" : "Ingreso"}
                {movement.type === "expense" ? ` · ${natureLabel(movement)}` : ""}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {movement.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground"
                >
                  {tag.name}
                </span>
              ))}
            </div>
            <span
              className={`text-base font-semibold tabular-nums ${
                movement.type === "expense" ? "text-red-600" : "text-emerald-600"
              }`}
            >
              {formatSignedAmountCents(movement.amountCents, movement.type)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
