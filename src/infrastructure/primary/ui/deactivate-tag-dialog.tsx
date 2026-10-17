"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import type { CatalogTagDTO } from "@/application/tag/dto";

import { deactivateTag, type TagActionState } from "../actions/deactivate-tag.action";
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

interface DeactivateTagDialogProps {
  tag: CatalogTagDTO;
  onClose: () => void;
}

export function DeactivateTagDialog({ tag, onClose }: DeactivateTagDialogProps) {
  const [open, setOpen] = useState(true);

  const close = () => {
    setOpen(false);
    onClose();
  };

  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => !nextOpen && close()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Desactivar etiqueta</AlertDialogTitle>
          <AlertDialogDescription>
            &quot;{tag.name}&quot; dejará de ofrecerse para nuevos movimientos. Los movimientos
            existentes la conservarán y seguirán computando en los desgloses.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <DeactivateTagForm tag={tag} onClose={close} />
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeactivateTagForm({ tag, onClose }: { tag: CatalogTagDTO; onClose: () => void }) {
  const [state, formAction, isPending] = useActionState(deactivateTag, {
    status: "idle",
  } satisfies TagActionState);

  useEffect(() => {
    if (state.status === "success") {
      onClose();
      toast.success(state.message);
    }
  }, [state, onClose]);

  return (
    <AlertDialogFooter>
      <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
      <form action={formAction} className="flex justify-end">
        <input type="hidden" name="tagId" value={tag.id} />
        <Button type="submit" variant="destructive" disabled={isPending}>
          {isPending ? "Desactivando…" : "Desactivar"}
        </Button>
      </form>
    </AlertDialogFooter>
  );
}
