"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import type { MovementDTO } from "@/application/movement/dto";

import { deleteMovement, type DeleteMovementState } from "../actions/delete-movement.action";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./components/ui/alert-dialog";
import { Button } from "./components/ui/button";
import { formatDate, formatSignedAmountCents } from "./format";

interface DeleteMovementDialogProps {
  movement: MovementDTO;
  onClose: () => void;
}

export function DeleteMovementDialog({ movement, onClose }: DeleteMovementDialogProps) {
  const [open, setOpen] = useState(true);

  const close = () => {
    setOpen(false);
    onClose();
  };

  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => !nextOpen && close()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar movimiento</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>
              <p>¿Eliminar este movimiento?</p>
              <dl className="mt-3 flex flex-col gap-1 text-sm">
                <div className="flex gap-2">
                  <dt className="font-medium">Concepto:</dt>
                  <dd>{movement.concept}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="font-medium">Importe:</dt>
                  <dd className="tabular-nums">
                    {formatSignedAmountCents(movement.amountCents, movement.type)}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="font-medium">Fecha:</dt>
                  <dd>{formatDate(movement.date)}</dd>
                </div>
              </dl>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <DeleteMovementForm movementId={movement.id} onClose={close} />
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteMovementForm({
  movementId,
  onClose,
}: {
  movementId: number;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState(deleteMovement, {
    status: "idle",
  } satisfies DeleteMovementState);

  useEffect(() => {
    if (state.status === "success") {
      onClose();
      toast.success(state.message);
    }
    if (state.status === "error") {
      onClose();
      toast.error(state.message);
    }
  }, [state, onClose]);

  return (
    <form action={formAction} className="flex justify-end">
      <input type="hidden" name="movementId" value={movementId} />
      <Button type="submit" variant="destructive" disabled={isPending}>
        {isPending ? "Eliminando…" : "Eliminar"}
      </Button>
    </form>
  );
}
