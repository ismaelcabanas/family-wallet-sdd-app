"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import type { CategoryDTO } from "@/application/tag-category/dto";

import { deleteCategory, type CategoryActionState } from "../actions/delete-category.action";
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

interface DeleteCategoryDialogProps {
  category: CategoryDTO;
  onClose: () => void;
}

export function DeleteCategoryDialog({ category, onClose }: DeleteCategoryDialogProps) {
  const [open, setOpen] = useState(true);

  const close = () => {
    setOpen(false);
    onClose();
  };

  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => !nextOpen && close()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar categoría</AlertDialogTitle>
          <AlertDialogDescription>
            Se eliminará la categoría &quot;{category.name}&quot;. Las etiquetas no se verán
            afectadas.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <DeleteCategoryForm category={category} onClose={close} />
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteCategoryForm({
  category,
  onClose,
}: {
  category: CategoryDTO;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState(deleteCategory, {
    status: "idle",
  } satisfies CategoryActionState);

  useEffect(() => {
    if (state.status === "success") {
      onClose();
      toast.success(state.message);
    }
  }, [state, onClose]);

  return (
    <AlertDialogFooter>
      <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
      <form action={formAction} className="flex flex-col gap-2">
        <input type="hidden" name="categoryId" value={category.id} />
        <Button type="submit" variant="destructive" disabled={isPending}>
          {isPending ? "Eliminando…" : "Eliminar"}
        </Button>
        {state.status === "error" ? (
          <p role="alert" className="text-sm text-red-600">
            {state.message}
          </p>
        ) : null}
      </form>
    </AlertDialogFooter>
  );
}
