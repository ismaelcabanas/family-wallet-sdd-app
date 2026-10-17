"use client";

import { useActionState, useEffect, useState } from "react";import { toast } from "sonner";

import type { CatalogTagDTO } from "@/application/tag/dto";

import { renameTag, type TagActionState } from "../actions/rename-tag.action";
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

interface RenameTagDialogProps {
  tag: CatalogTagDTO;
  onClose: () => void;
}

export function RenameTagDialog({ tag, onClose }: RenameTagDialogProps) {
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
          <DialogTitle>Renombrar etiqueta</DialogTitle>
        </DialogHeader>
        <RenameTagForm tag={tag} onClose={close} />
      </DialogContent>
    </Dialog>
  );
}

function RenameTagForm({ tag, onClose }: { tag: CatalogTagDTO; onClose: () => void }) {
  const [name, setName] = useState(tag.name);
  const [state, formAction, isPending] = useActionState(renameTag, {
    status: "idle",
  } satisfies TagActionState);

  useEffect(() => {
    if (state.status === "success") {
      onClose();
      toast.success(state.message);
    }
  }, [state, onClose]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="tagId" value={tag.id} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="rename-tag-name">Nombre</Label>
        <Input
          id="rename-tag-name"
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
          disabled={isPending}
          aria-describedby={state.status === "error" ? "rename-tag-error" : undefined}
        />
        {state.status === "error" ? (
          <p role="alert" id="rename-tag-error" className="text-sm text-red-600">
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
