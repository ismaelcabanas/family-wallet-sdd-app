"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import type { AccountDTO, MovementDTO, TagDTO } from "@/application/movement/dto";

import { updateMovement, type UpdateMovementState } from "../actions/update-movement.action";
import { Button } from "./components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./components/ui/dialog";
import { MovementFormFields, type MovementFormInitialValues } from "./movement-form";

interface EditMovementDialogProps {
  movement: MovementDTO;
  accounts: AccountDTO[];
  tags: TagDTO[];
  currentAccountId: number;
  currentMonth: string;
  onClose: () => void;
}

const NOT_FOUND_MESSAGE = "El movimiento ya no existe.";

export function EditMovementDialog({
  movement,
  accounts,
  tags,
  currentAccountId,
  currentMonth,
  onClose,
}: EditMovementDialogProps) {
  const [open, setOpen] = useState(true);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
        setOpen(nextOpen);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar movimiento</DialogTitle>
        </DialogHeader>
        <EditMovementForm
          movement={movement}
          accounts={accounts}
          tags={tags}
          currentAccountId={currentAccountId}
          currentMonth={currentMonth}
          onClose={() => {
            setOpen(false);
            onClose();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function EditMovementForm({
  movement,
  accounts,
  tags,
  currentAccountId,
  currentMonth,
  onClose,
}: Omit<EditMovementDialogProps, "onClose"> & { onClose: () => void }) {
  const [state, formAction, isPending] = useActionState(updateMovement, {
    status: "idle",
  } satisfies UpdateMovementState);

  useEffect(() => {
    if (state.status === "success") {
      onClose();
      toast.success(state.message);
    }
    if (state.status === "error" && state.errors._form?.[0] === NOT_FOUND_MESSAGE) {
      onClose();
      toast.error(NOT_FOUND_MESSAGE);
    }
  }, [state, onClose]);

  const initialValues: MovementFormInitialValues = {
    date: movement.date,
    concept: movement.concept,
    description: movement.description ?? "",
    amountCents: movement.amountCents,
    accountId: movement.accountId,
    type: movement.type,
    nature: movement.nature,
    tagIds: movement.tags.map((tag) => tag.id),
  };

  return (
    <MovementFormFields
      state={state}
      formAction={formAction}
      isPending={isPending}
      tags={tags}
      accounts={accounts}
      initialValues={initialValues}
      submitLabel="Guardar cambios"
      secondaryActions={
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
      }
    >
      <input type="hidden" name="movementId" value={movement.id} />
      <input type="hidden" name="currentAccountId" value={currentAccountId} />
      <input type="hidden" name="currentMonth" value={currentMonth} />
    </MovementFormFields>
  );
}
