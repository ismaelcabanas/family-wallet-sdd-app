"use client";

import { useState } from "react";

import type { AccountDTO, MovementDTO, TagDTO } from "@/application/movement/dto";

import { CreateMovementDialog } from "./create-movement-dialog";
import { DeleteMovementDialog } from "./delete-movement-dialog";
import { EditMovementDialog } from "./edit-movement-dialog";
import { EmptyState } from "./empty-state";
import { formatDate, formatSignedAmountCents } from "./format";
import { Button } from "./components/ui/button";

interface DateGroup {
  date: string;
  movements: MovementDTO[];
}

export function groupMovementsByDate(movements: MovementDTO[]): DateGroup[] {
  return movements.reduce<DateGroup[]>((groups, movement) => {
    const current = groups.at(-1);
    if (current !== undefined && current.date === movement.date) {
      current.movements.push(movement);
      return groups;
    }
    groups.push({ date: movement.date, movements: [movement] });
    return groups;
  }, []);
}

function natureLabel(movement: MovementDTO): string {
  return movement.nature === "shared" ? "Común" : "Personal";
}

interface GroupedMovementListProps {
  movements: MovementDTO[];
  accounts: AccountDTO[];
  tags: TagDTO[];
  currentAccountId: number;
  currentMonth: string;
  accountName: string;
  accountType: "personal" | "shared";
}

export function GroupedMovementList({
  movements,
  accounts,
  tags,
  currentAccountId,
  currentMonth,
  accountName,
  accountType,
}: GroupedMovementListProps) {
  const [editing, setEditing] = useState<MovementDTO | null>(null);
  const [deleting, setDeleting] = useState<MovementDTO | null>(null);
  const [creating, setCreating] = useState(false);

  const groups = groupMovementsByDate(movements);

  return (
    <>
      {movements.length === 0 ? (
        <EmptyState>
          <Button type="button" size="sm" onClick={() => setCreating(true)}>
            Nuevo movimiento
          </Button>
        </EmptyState>
      ) : (
        <section aria-labelledby="movement-list-title">
          <div className="mb-2 flex items-center justify-between">
            <h2 id="movement-list-title" className="text-lg font-semibold">
              Movimientos del mes
            </h2>
            <Button type="button" size="sm" onClick={() => setCreating(true)}>
              Nuevo movimiento
            </Button>
          </div>
          <div className="flex flex-col gap-4">
            {groups.map((group) => (
              <div key={group.date} className="rounded-lg border">
                <h3 className="border-b px-4 py-2 text-sm font-medium text-muted-foreground">
                  <time dateTime={group.date}>{formatDate(group.date)}</time>
                </h3>
                <ul className="divide-y">
                  {group.movements.map((movement) => (
                    <li
                      key={movement.id}
                      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 p-4"
                      data-testid="movement-item"
                    >
                      <div className="flex min-w-0 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-1">
                          {movement.tags.map((tag) => (
                            <span
                              key={tag.id}
                              className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {movement.concept}
                          {movement.description !== null ? ` · ${movement.description}` : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {movement.type === "expense" ? (
                          <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                            {natureLabel(movement)}
                          </span>
                        ) : null}
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
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {creating ? (
        <CreateMovementDialog
          accountId={currentAccountId}
          accountName={accountName}
          accountType={accountType}
          tags={tags}
          onClose={() => setCreating(false)}
        />
      ) : null}

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
    </>
  );
}
