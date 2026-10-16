"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { toast } from "sonner";

import type { CommonContributionDTO } from "@/application/common-contribution/dto";

import {
  configureCommonContribution,
  type ConfigureCommonContributionState,
} from "../actions/configure-common-contribution.action";
import { Button } from "./components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./components/ui/dialog";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { formatBasisPointsForInput } from "./format";

export interface CommonContributionConfigDialogProps {
  accountId: number;
  memberName: string | null;
  config: CommonContributionDTO | null;
  onClose: () => void;
}

export function CommonContributionConfigDialog({
  accountId,
  config,
  onClose,
}: CommonContributionConfigDialogProps) {
  const [open, setOpen] = useState(true);
  const [state, formAction, isPending] = useActionState(configureCommonContribution, {
    status: "idle",
  } satisfies ConfigureCommonContributionState);

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

  const defaultPercentage = config === null ? "" : formatBasisPointsForInput(config.percentageBasisPoints);

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
          <DialogTitle>Aportación a la cuenta común</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="accountId" value={accountId} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="common-contribution-percentage">Porcentaje (%)</Label>
            <Input
              ref={percentageRef}
              id="common-contribution-percentage"
              name="percentage"
              inputMode="decimal"
              placeholder="25"
              defaultValue={fieldValue("percentage", defaultPercentage)}
              disabled={isPending}
              aria-describedby={
                fieldError("percentage") ? "common-contribution-percentage-error" : undefined
              }
            />
            {fieldError("percentage") ? (
              <p role="alert" id="common-contribution-percentage-error" className="text-sm text-red-600">
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
