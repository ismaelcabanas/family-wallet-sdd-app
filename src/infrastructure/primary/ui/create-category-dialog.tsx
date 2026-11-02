"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { createCategory, type CategoryActionState } from "../actions/create-category.action";
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

interface CreateCategoryDialogProps {
  onClose: () => void;
}

export function CreateCategoryDialog({ onClose }: CreateCategoryDialogProps) {
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
          <DialogTitle>Nueva categoría</DialogTitle>
        </DialogHeader>
        <CreateCategoryForm onClose={close} />
      </DialogContent>
    </Dialog>
  );
}

function CreateCategoryForm({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [state, formAction, isPending] = useActionState(createCategory, {
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
      <div className="flex flex-col gap-2">
        <Label htmlFor="create-category-name">Nombre</Label>
        <Input
          id="create-category-name"
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
          disabled={isPending}
          aria-describedby={state.status === "error" ? "create-category-error" : undefined}
        />
        {state.status === "error" ? (
          <p role="alert" id="create-category-error" className="text-sm text-red-600">
            {state.message}
          </p>
        ) : null}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creando…" : "Crear"}
        </Button>
      </DialogFooter>
    </form>
  );
}
