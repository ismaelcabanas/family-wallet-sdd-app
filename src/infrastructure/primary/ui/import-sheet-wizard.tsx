"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import type { AccountDTO } from "@/application/movement/dto";

import { importSheetAction, type ImportSheetResult } from "../actions/import-sheet.action";
import { Button } from "./components/ui/button";
import { Label } from "./components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";
import { formatAmountCents, formatDate, monthLabel } from "./format";

export function ImportSheetWizard({
  accounts,
  months,
}: {
  accounts: AccountDTO[];
  months: string[];
}) {
  const [accountId, setAccountId] = useState("");
  const [month, setMonth] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportSheetResult>({ status: "idle" });
  const [isWorking, startWork] = useTransition();

  const preview = result.status === "preview" ? result.preview : null;
  const imported = result.status === "imported" ? result : null;
  const errorMessage = result.status === "error" ? result.message : null;
  const showSelection = imported === null;

  const canPreview = accountId !== "" && month !== "" && file !== null && !isWorking;
  const canConfirm =
    preview !== null && preview.totals.errors === 0 && preview.totals.movements > 0 && !isWorking;

  function selectAccount(value: string) {
    setAccountId(value);
    setResult({ status: "idle" });
  }

  function selectMonth(value: string) {
    setMonth(value);
    setResult({ status: "idle" });
  }

  function selectFile(selected: File | null) {
    setFile(selected);
    setResult({ status: "idle" });
  }

  function runPreview() {
    if (!canPreview || file === null) return;
    const currentFile = file;
    startWork(async () => {
      setResult(
        await importSheetAction({ accountId, month, intent: "preview", file: currentFile }),
      );
    });
  }

  function runConfirm() {
    if (!canConfirm || file === null) return;
    const currentFile = file;
    startWork(async () => {
      setResult(
        await importSheetAction({ accountId, month, intent: "confirm", file: currentFile }),
      );
    });
  }

  function resetAll() {
    setAccountId("");
    setMonth("");
    setFile(null);
    setResult({ status: "idle" });
  }

  const importedAccountName = imported
    ? (accounts.find((account) => account.id === imported.accountId)?.name ?? "")
    : "";

  return (
    <div className="flex flex-col gap-6">
      {showSelection ? (
        <section aria-label="Importación de hoja mensual" className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="import-account">Cuenta</Label>
              <Select value={accountId === "" ? undefined : accountId} onValueChange={selectAccount}>
                <SelectTrigger id="import-account" className="w-full" aria-label="Cuenta">
                  <SelectValue placeholder="Selecciona cuenta" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={String(account.id)}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="import-month">Mes</Label>
              <Select value={month === "" ? undefined : month} onValueChange={selectMonth}>
                <SelectTrigger id="import-month" className="w-full" aria-label="Mes">
                  <SelectValue placeholder="Selecciona mes" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((candidate) => (
                    <SelectItem key={candidate} value={candidate}>
                      {monthLabel(candidate)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="import-sheet-file">Fichero CSV</Label>
            <input
              id="import-sheet-file"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
            />
          </div>
          <div className="flex items-center gap-2 self-start">
            <Button type="button" onClick={runPreview} disabled={!canPreview}>
              {isWorking && preview === null ? "Previsualizando…" : "Previsualizar importación"}
            </Button>
          </div>
          {errorMessage ? (
            <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-600">
              {errorMessage}
            </p>
          ) : null}
        </section>
      ) : null}

      {preview ? (
        <section aria-label="Resumen de la importación" className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">
            {preview.totals.movements} movimientos para {preview.accountName} ·{" "}
            {monthLabel(preview.month)}
          </h2>
          <div className="flex flex-col gap-1 text-sm">
            <p>
              Gastos personales: {formatAmountCents(preview.totals.personalExpenseCents)}
            </p>
            <p>Gastos compartidos: {formatAmountCents(preview.totals.sharedExpenseCents)}</p>
            <p>Ingresos: {formatAmountCents(preview.totals.incomeCents)}</p>
          </div>

          <section aria-label="Etiquetas que se crearán" className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Etiquetas que se crearán</h3>
            {preview.tagsToCreate.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {preview.tagsToCreate.map((name) => (
                  <li
                    key={name}
                    className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Ninguna etiqueta nueva.</p>
            )}
          </section>

          {preview.rows.some((row) => row.status === "ignored") ? (
            <section aria-label="Filas ignoradas" className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold">Filas ignoradas</h3>
              <ul className="text-sm text-muted-foreground">
                {preview.rows
                  .filter((row) => row.status === "ignored")
                  .map((row) => (
                    <li key={row.line}>
                      Fila {row.line}: {row.reason}
                    </li>
                  ))}
              </ul>
            </section>
          ) : null}

          {preview.rows.some((row) => row.status === "error") ? (
            <section
              aria-label="Filas con error"
              role="alert"
              className="flex flex-col gap-1 rounded-md bg-red-50 p-3"
            >
              <h3 className="text-sm font-semibold text-red-600">Filas con error</h3>
              <ul className="text-sm text-red-600">
                {preview.rows
                  .filter((row) => row.status === "error")
                  .map((row) => (
                    <li key={row.line}>
                      Fila {row.line}: {row.reason}
                    </li>
                  ))}
              </ul>
            </section>
          ) : null}

          <div className="overflow-x-auto rounded-lg border">
            <table aria-label="Movimientos detectados" className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Fila</th>
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Nota</th>
                  <th className="px-3 py-2 font-medium">Importe</th>
                  <th className="px-3 py-2 font-medium">Tipo</th>
                  <th className="px-3 py-2 font-medium">Naturaleza</th>
                  <th className="px-3 py-2 font-medium">Etiqueta</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {preview.rows
                  .filter((row) => row.status === "ok" && row.movement !== undefined)
                  .map((row) => (
                    <tr key={row.line}>
                      <td className="px-3 py-2">{row.line}</td>
                      <td className="px-3 py-2">{formatDate(row.movement!.date)}</td>
                      <td className="px-3 py-2">{row.movement!.note}</td>
                      <td className="px-3 py-2">{formatAmountCents(row.movement!.amountCents)}</td>
                      <td className="px-3 py-2">
                        {row.movement!.type === "expense" ? "Gasto" : "Ingreso"}
                      </td>
                      <td className="px-3 py-2">
                        {row.movement!.nature === null
                          ? "—"
                          : row.movement!.nature === "personal"
                            ? "Personal"
                            : "Compartido"}
                      </td>
                      <td className="px-3 py-2">
                        {row.movement!.tagName === null
                          ? "—"
                          : `${row.movement!.tagName}${row.movement!.createsTag ? " (nueva)" : ""}`}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-2 self-start">
            <Button type="button" variant="outline" onClick={() => setResult({ status: "idle" })}>
              Volver
            </Button>
            <Button type="button" onClick={runConfirm} disabled={!canConfirm}>
              {isWorking && preview !== null
                ? "Importando…"
                : `Confirmar importación (${preview.totals.movements} movimientos)`}
            </Button>
          </div>
        </section>
      ) : null}

      {imported ? (
        <section aria-label="Importación completada" className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">
            Importación completada: {imported.movementsCreated} movimientos
            {imported.tagsCreated > 0
              ? ` · ${imported.tagsCreated} ${imported.tagsCreated === 1 ? "etiqueta creada" : "etiquetas creadas"}`
              : ""}
          </h2>
          <Link
            href={`/accounts/${imported.accountId}?month=${imported.month}`}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            Ver los movimientos en {importedAccountName} · {monthLabel(imported.month)}
          </Link>
          <Button type="button" variant="outline" onClick={resetAll} className="self-start">
            Realizar otra importación
          </Button>
        </section>
      ) : null}
    </div>
  );
}
