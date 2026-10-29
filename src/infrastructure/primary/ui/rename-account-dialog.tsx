"use client";

import { useActionState, useEffect, useState } from "react";import { toast } from "sonner";

import { renameAccount, type AccountActionState } from "../actions/rename-account.action";
import { Button } from "./components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./components/ui/dialog";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";

interface RenameAccountDialogProps {
  accountId: number;
  accountName: string;
  onClose: () => void;
}

export function RenameAccountDialog({ accountId, accountName, onClose }: RenameAccountDialogProps) {
  const [open, setOpen] = useState(true);

  const close = () => {
    setOpen(false);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) close();
        setOpen(nextOpen);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Renombrar cuenta</DialogTitle>
        </DialogHeader>
        <RenameAccountForm accountId={accountId} accountName={accountName} onClose={close} />
      </DialogContent>
    </Dialog>
  );
}

function RenameAccountForm({
  accountId,
  accountName,
  onClose,
}: {
  accountId: number;
  accountName: string;
  onClose: () => void;
}) {
  const [name, setName] = useState(accountName);
  const [state, formAction, isPending] = useActionState(renameAccount, {
    status: "idle",
  } satisfies AccountActionState);

  useEffect(() => {
    if (state.status === "success") {
      onClose();
      toast.success(state.message);
    }
  }, [state, onClose]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="accountId" value={accountId} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="rename-account-name">Nombre de la cuenta</Label>
        <Input
          id="rename-account-name"
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
          disabled={isPending}
          aria-describedby={state.status === "error" ? "rename-account-error" : undefined}
        />
        {state.status === "error" ? (
          <p role="alert" id="rename-account-error" className="text-sm text-red-600">
            {state.message}
          </p>
        ) : null}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando…" : "Guardar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
