"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { toast } from "sonner";

import type { RegularIncomeDTO } from "@/application/regular-income/dto";

import {
  configureRegularIncome,
  type ConfigureRegularIncomeState,
} from "../actions/configure-regular-income.action";
import { Button } from "./components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./components/ui/dialog";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { formatAmountCents, formatCentsForInput } from "./format";

interface RegularIncomePanelProps {
  accountId: number;
  memberName: string | null;
  config: RegularIncomeDTO | null;
}

export function RegularIncomePanel({ accountId, memberName, config }: RegularIncomePanelProps) {
  const [editing, setEditing] = useState(false);

  return (
    <section
      aria-labelledby="regular-income-title"
      data-testid="regular-income-panel"
      className="rounded-lg border bg-card p-4 text-card-foreground"
    >
      <h2 id="regular-income-title" className="text-sm font-medium text-muted-foreground">
        Ingreso regular
      </h2>

      {config === null ? (
        <div className="mt-2 flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Configura tu ingreso mensual habitual y aparecerá cada mes sin registrarlo a mano.
          </p>
          <Button type="button" className="self-start" onClick={() => setEditing(true)}>
            Configurar ingreso
          </Button>
        </div>
      ) : config.active ? (
        <div className="mt-2 flex flex-col gap-3">
          <p className="text-xl font-semibold tabular-nums">
            {formatAmountCents(config.amountCents)} el día {config.dayOfMonth} de cada mes
          </p>
          <p className="text-sm text-muted-foreground">
            Nota: {config.note} <span aria-hidden="true">·</span>{" "}
            <span className="text-foreground">Activa</span>
          </p>
          <div className="flex items-center gap-2 self-start">
            <Button type="button" variant="outline" onClick={() => setEditing(true)}>
              Editar ingreso
            </Button>
            <PanelDeactivateForm accountId={accountId} />
          </div>
        </div>
      ) : (
        <div className="mt-2 flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">Ingreso regular desactivado.</p>
          <Button type="button" variant="outline" className="self-start" onClick={() => setEditing(true)}>
            Editar ingreso
          </Button>
        </div>
      )}

      {editing ? (
        <RegularIncomeConfigDialog
          accountId={accountId}
          memberName={memberName}
          config={config}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </section>
  );
}

function PanelDeactivateForm({ accountId }: { accountId: number }) {
  const [state, formAction, isPending] = useActionState(configureRegularIncome, {
    status: "idle",
  } satisfies ConfigureRegularIncomeState);

  const handledRef = useRef(false);

  useEffect(() => {
    if (state.status !== "success" || handledRef.current) return;
    handledRef.current = true;
    toast.success(state.message);
  }, [state]);

  return (
    <form action={formAction}>
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="intent" value="deactivate" />
      <Button type="submit" variant="outline" disabled={isPending}>
        {isPending ? "Guardando…" : "Desactivar"}
      </Button>
      {state.status === "error" && state.errors._form ? (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {state.errors._form[0]}
        </p>
      ) : null}
    </form>
  );
}

interface RegularIncomeConfigDialogProps {
  accountId: number;
  memberName: string | null;
  config: RegularIncomeDTO | null;
  onClose: () => void;
}

function RegularIncomeConfigDialog({
  accountId,
  memberName,
  config,
  onClose,
}: RegularIncomeConfigDialogProps) {
  const [open, setOpen] = useState(true);
  const [state, formAction, isPending] = useActionState(configureRegularIncome, {
    status: "idle",
  } satisfies ConfigureRegularIncomeState);

  const amountRef = useRef<HTMLInputElement>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    if (state.status !== "success" || handledRef.current) return;
    handledRef.current = true;
    toast.success(state.message);
    setOpen(false);
    onClose();
  }, [state, onClose]);

  const fieldError = (field: "amount" | "dayOfMonth" | "note"): string | undefined =>
    state.status === "error" ? state.errors[field]?.[0] : undefined;

  const fieldValue = (field: "amount" | "dayOfMonth" | "note", fallback: string): string =>
    state.status === "error" ? (state.values[field] ?? fallback) : fallback;

  const defaultAmount = config === null ? "" : formatCentsForInput(config.amountCents);
  const defaultDay = config === null ? "1" : String(config.dayOfMonth);
  const defaultNote = config === null ? "" : config.note;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
        setOpen(nextOpen);
      }}
    >
      <DialogContent
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          amountRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Ingreso regular</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="accountId" value={accountId} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="regular-income-amount">Importe (€)</Label>
            <Input
              ref={amountRef}
              id="regular-income-amount"
              name="amount"
              inputMode="decimal"
              placeholder="0,00"
              defaultValue={fieldValue("amount", defaultAmount)}
              disabled={isPending}
              aria-describedby={fieldError("amount") ? "regular-income-amount-error" : undefined}
            />
            {fieldError("amount") ? (
              <p role="alert" id="regular-income-amount-error" className="text-sm text-red-600">
                {fieldError("amount")}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="regular-income-day">Día del mes</Label>
            <Input
              id="regular-income-day"
              name="dayOfMonth"
              inputMode="numeric"
              placeholder="1"
              defaultValue={fieldValue("dayOfMonth", defaultDay)}
              disabled={isPending}
              aria-describedby={fieldError("dayOfMonth") ? "regular-income-day-error" : undefined}
            />
            {fieldError("dayOfMonth") ? (
              <p role="alert" id="regular-income-day-error" className="text-sm text-red-600">
                {fieldError("dayOfMonth")}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="regular-income-note">Nota</Label>
            <Input
              id="regular-income-note"
              name="note"
              placeholder={`Ingreso regular de ${memberName ?? "miembro"}`}
              defaultValue={fieldValue("note", defaultNote)}
              disabled={isPending}
              aria-describedby={fieldError("note") ? "regular-income-note-error" : undefined}
            />
            {fieldError("note") ? (
              <p role="alert" id="regular-income-note-error" className="text-sm text-red-600">
                {fieldError("note")}
              </p>
            ) : null}
          </div>

          {state.status === "error" && state.errors._form ? (
            <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-600">
              {state.errors._form[0]}
            </p>
          ) : null}

          <div className="flex items-center gap-2 self-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
            {config?.active ? (
              <Button
                type="submit"
                name="intent"
                value="deactivate"
                variant="outline"
                disabled={isPending}
              >
                {isPending ? "Guardando…" : "Desactivar"}
              </Button>
            ) : null}
            <Button type="submit" name="intent" value="save" disabled={isPending}>
              {isPending ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
