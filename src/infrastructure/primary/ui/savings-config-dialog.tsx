"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { toast } from "sonner";

import type { SavingsAllocationDTO } from "@/application/savings/dto";

import {
  configureSavingsAllocation,
  type ConfigureSavingsAllocationState,
} from "../actions/configure-savings-allocation.action";
import { Button } from "./components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./components/ui/dialog";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";

export interface SavingsConfigDialogProps {
  accountId: number;
  memberName: string | null;
  config: SavingsAllocationDTO | null;
  onClose: () => void;
}

export function SavingsConfigDialog({
  accountId,
  config,
  onClose,
}: SavingsConfigDialogProps) {
  const [open, setOpen] = useState(true);
  const [state, formAction, isPending] = useActionState(configureSavingsAllocation, {
    status: "idle",
  } satisfies ConfigureSavingsAllocationState);

  const percentageRef = useRef<HTMLInputElement>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    if (state.status !== "success" || handledRef.current) return;
    handledRef.current = true;
    toast.success(state.message);
    setOpen(false);
    onClose();
  }, [state, onClose]);

  const fieldError = (field: "percentage"): string | undefined =>
    state.status === "error" ? state.errors[field]?.[0] : undefined;

  const fieldValue = (field: "percentage", fallback: string): string =>
    state.status === "error" ? (state.values[field] ?? fallback) : fallback;

  const defaultPercentage = config === null ? "" : String(config.percentage);

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
          percentageRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Ahorro mensual</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="accountId" value={accountId} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="savings-percentage">Porcentaje (%)</Label>
            <Input
              ref={percentageRef}
              id="savings-percentage"
              name="percentage"
              inputMode="numeric"
              placeholder="10"
              defaultValue={fieldValue("percentage", defaultPercentage)}
              disabled={isPending}
              aria-describedby={
                fieldError("percentage") ? "savings-percentage-error" : undefined
              }
            />
            {fieldError("percentage") ? (
              <p role="alert" id="savings-percentage-error" className="text-sm text-red-600">
                {fieldError("percentage")}
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
