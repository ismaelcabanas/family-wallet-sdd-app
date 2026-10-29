"use client";

import { useActionState, useEffect, useState } from "react";import { toast } from "sonner";

import { renameMember, type MemberActionState } from "../actions/rename-member.action";
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

interface RenameMemberDialogProps {
  memberId: number;
  memberName: string;
  onClose: () => void;
}

export function RenameMemberDialog({ memberId, memberName, onClose }: RenameMemberDialogProps) {
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
          <DialogTitle>Renombrar miembro</DialogTitle>
        </DialogHeader>
        <RenameMemberForm memberId={memberId} memberName={memberName} onClose={close} />
      </DialogContent>
    </Dialog>
  );
}

function RenameMemberForm({
  memberId,
  memberName,
  onClose,
}: {
  memberId: number;
  memberName: string;
  onClose: () => void;
}) {
  const [name, setName] = useState(memberName);
  const [state, formAction, isPending] = useActionState(renameMember, {
    status: "idle",
  } satisfies MemberActionState);

  useEffect(() => {
    if (state.status === "success") {
      onClose();
      toast.success(state.message);
    }
  }, [state, onClose]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="memberId" value={memberId} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="rename-member-name">Nombre del miembro</Label>
        <Input
          id="rename-member-name"
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
          disabled={isPending}
          aria-describedby={state.status === "error" ? "rename-member-error" : undefined}
        />
        {state.status === "error" ? (
          <p role="alert" id="rename-member-error" className="text-sm text-red-600">
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
