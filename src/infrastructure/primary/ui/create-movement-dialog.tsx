"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import type { TagDTO } from "@/application/movement/dto";

import {
  createMovement,
  type CreateMovementState,
} from "../actions/create-movement.action";
import { Button } from "./components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./components/ui/dialog";
import { MovementFormFields } from "./movement-form";

interface CreateMovementDialogProps {
  accountId: number;
  accountName: string;
  accountType: "personal" | "shared";
  tags: TagDTO[];
  onClose: () => void;
}

export function CreateMovementDialog({
  accountId,
  accountName,
  accountType,
  tags,
  onClose,
}: CreateMovementDialogProps) {
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
          <DialogTitle>Nuevo movimiento</DialogTitle>
        </DialogHeader>
        <CreateMovementForm
          accountId={accountId}
          accountName={accountName}
          accountType={accountType}
          tags={tags}
          onClose={() => {
            setOpen(false);
            onClose();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function CreateMovementForm({
  accountId,
  accountName,
  accountType,
  tags,
  onClose,
}: Omit<CreateMovementDialogProps, "onClose"> & { onClose: () => void }) {
  const [state, formAction, isPending] = useActionState(createMovement, {
    status: "idle",
  } satisfies CreateMovementState);

  useEffect(() => {
    if (state.status === "success") {
      onClose();
      toast.success("Movimiento guardado");
    }
  }, [state, onClose]);

  return (
    <MovementFormFields
      state={state}
      formAction={formAction}
      isPending={isPending}
      tags={tags}
      accountId={accountId}
      accountName={accountName}
      accountType={accountType}
      secondaryActions={
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
      }
    />
  );
}
