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
import { formatCentsForInput } from "./format";

export interface RegularIncomeConfigDialogProps {
  accountId: number;
  memberName: string | null;
  config: RegularIncomeDTO | null;
  onClose: () => void;
}

export function RegularIncomeConfigDialog({
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
