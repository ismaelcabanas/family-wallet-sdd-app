"use client";

import { useState } from "react";

import type { MovementDTO } from "@/application/movement/dto";
import type { ActiveTagGroupDTO } from "@/application/tag/dto";
import { isProtectedTagSlug } from "@/domain/tag/SystemTags";

import { BulkRetagDialog } from "./bulk-retag-dialog";
import { CreateMovementDialog } from "./create-movement-dialog";
import { DeleteMovementDialog } from "./delete-movement-dialog";
import { EditMovementDialog } from "./edit-movement-dialog";
import { EmptyState } from "./empty-state";
import { formatDate, formatSignedAmountCents } from "./format";
import { Button } from "./components/ui/button";
import { Checkbox } from "./components/ui/checkbox";

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
  tagGroups: ActiveTagGroupDTO[];
  currentAccountId: number;
  currentMonth: string;
  accountName: string;
  accountType: "personal" | "shared";
}

export function GroupedMovementList({
  movements,
  tagGroups,
  currentAccountId,
  currentMonth,
  accountName,
  accountType,
}: GroupedMovementListProps) {
  const [editing, setEditing] = useState<MovementDTO | null>(null);
  const [deleting, setDeleting] = useState<MovementDTO | null>(null);
  const [creating, setCreating] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [retagOpen, setRetagOpen] = useState(false);

  const groups = groupMovementsByDate(movements);
  const selectableIds = movements
    .filter((movement) => !(movement.tag !== null && isProtectedTagSlug(movement.tag.slug)))
    .map((movement) => movement.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));

  function toggleSelected(id: number) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(selectableIds));
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setRetagOpen(false);
  }

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
            <div className="flex items-center gap-2">
              {selectionMode ? null : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectionMode(true)}
                >
                  Seleccionar
                </Button>
              )}
              <Button type="button" size="sm" onClick={() => setCreating(true)}>
                Nuevo movimiento
              </Button>
            </div>
          </div>
          {selectionMode ? (
            <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-2">
              <span className="px-1 text-sm font-medium">{selectedIds.size} seleccionados</span>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" variant="outline" onClick={toggleSelectAll}>
                  {allSelected ? "Ninguno" : "Seleccionar todo"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={selectedIds.size === 0}
                  onClick={() => setRetagOpen(true)}
                >
                  Cambiar etiqueta…
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={exitSelectionMode}>
                  Salir de la selección
                </Button>
              </div>
            </div>
          ) : null}
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
                      {selectionMode ? (
                        movement.tag !== null && isProtectedTagSlug(movement.tag.slug) ? (
                          <span aria-hidden="true" className="size-11 shrink-0" />
                        ) : (
                          <Checkbox
                            checked={selectedIds.has(movement.id)}
                            onCheckedChange={() => toggleSelected(movement.id)}
                            aria-label={`Seleccionar ${movement.note}`}
                            className="relative before:absolute before:-inset-3.5"
                          />
                        )
                      ) : null}
                      <div className="flex min-w-0 flex-col gap-1">
                        {movement.tag !== null ? (
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                              {movement.tag.name}
                            </span>
                          </div>
                        ) : null}
                        <span className="text-xs text-muted-foreground">{movement.note}</span>
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
                            aria-label={`Editar ${movement.note}`}
                            title={`Editar ${movement.note}`}
                            onClick={() => setEditing(movement)}
                            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            aria-label={`Eliminar ${movement.note}`}
                            title={`Eliminar ${movement.note}`}
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
          tagGroups={tagGroups}
          onClose={() => setCreating(false)}
        />
      ) : null}

      {editing ? (
        <EditMovementDialog
          movement={editing}
          tagGroups={tagGroups}
          currentAccountId={currentAccountId}
          currentMonth={currentMonth}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {deleting ? (
        <DeleteMovementDialog movement={deleting} onClose={() => setDeleting(null)} />
      ) : null}

      {selectionMode && retagOpen ? (
        <BulkRetagDialog
          accountId={currentAccountId}
          month={currentMonth}
          movementIds={[...selectedIds]}
          tagGroups={tagGroups}
          onClose={() => setRetagOpen(false)}
          onSuccess={exitSelectionMode}
        />
      ) : null}
    </>
  );
}
