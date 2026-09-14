"use client";

import { useState } from "react";

import type { AccountDTO, MovementDTO, TagDTO } from "@/application/movement/dto";

import { DeleteMovementDialog } from "./delete-movement-dialog";
import { EditMovementDialog } from "./edit-movement-dialog";
import { formatSignedAmountCents } from "./format";

function natureLabel(movement: MovementDTO): string {
  if (movement.type === "income") return "";
  return movement.nature === "shared" ? "Compartido" : "Personal";
}

interface MovementListProps {
  movements: MovementDTO[];
  accounts: AccountDTO[];
  tags: TagDTO[];
  currentAccountId: number;
  currentMonth: string;
}

export function MovementList({
  movements,
  accounts,
  tags,
  currentAccountId,
  currentMonth,
}: MovementListProps) {
  const [editing, setEditing] = useState<MovementDTO | null>(null);
  const [deleting, setDeleting] = useState<MovementDTO | null>(null);

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
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label={`Editar ${movement.concept}`}
                title={`Editar ${movement.concept}`}
                onClick={() => setEditing(movement)}
                className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                ✏️
              </button>
              <button
                type="button"
                aria-label={`Eliminar ${movement.concept}`}
                title={`Eliminar ${movement.concept}`}
                onClick={() => setDeleting(movement)}
                className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                🗑️
              </button>
            </div>
          </li>
        ))}
      </ul>

      {editing ? (
        <EditMovementDialog
          movement={editing}
          accounts={accounts}
          tags={tags}
          currentAccountId={currentAccountId}
          currentMonth={currentMonth}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {deleting ? (
        <DeleteMovementDialog movement={deleting} onClose={() => setDeleting(null)} />
      ) : null}
    </section>
  );
}
