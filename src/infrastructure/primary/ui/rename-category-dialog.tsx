"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import type { CategoryDTO } from "@/application/tag-category/dto";

import { renameCategory, type CategoryActionState } from "../actions/rename-category.action";
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

interface RenameCategoryDialogProps {
  category: CategoryDTO;
  onClose: () => void;
}

export function RenameCategoryDialog({ category, onClose }: RenameCategoryDialogProps) {
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
          <DialogTitle>Renombrar categoría</DialogTitle>
        </DialogHeader>
        <RenameCategoryForm category={category} onClose={close} />
      </DialogContent>
    </Dialog>
  );
}

function RenameCategoryForm({
  category,
  onClose,
}: {
  category: CategoryDTO;
  onClose: () => void;
}) {
  const [name, setName] = useState(category.name);
  const [state, formAction, isPending] = useActionState(renameCategory, {
    status: "idle",
  } satisfies CategoryActionState);

  useEffect(() => {
    if (state.status === "success") {
      onClose();
      toast.success(state.message);
    }
  }, [state, onClose]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="categoryId" value={category.id} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="rename-category-name">Nombre</Label>
        <Input
          id="rename-category-name"
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
          disabled={isPending}
          aria-describedby={state.status === "error" ? "rename-category-error" : undefined}
        />
        {state.status === "error" ? (
          <p role="alert" id="rename-category-error" className="text-sm text-red-600">
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
