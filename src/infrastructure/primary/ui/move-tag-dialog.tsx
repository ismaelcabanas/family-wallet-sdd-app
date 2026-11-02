"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import type { CategoryDTO } from "@/application/tag-category/dto";
import type { CatalogTagDTO } from "@/application/tag/dto";

import { moveTagToCategory, type CategoryActionState } from "../actions/move-tag-to-category.action";
import { Button } from "./components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./components/ui/dialog";
import { Label } from "./components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";

interface MoveTagDialogProps {
  tag: CatalogTagDTO;
  categories: CategoryDTO[];
  currentCategoryId: number;
  onClose: () => void;
}

export function MoveTagDialog({
  tag,
  categories,
  currentCategoryId,
  onClose,
}: MoveTagDialogProps) {
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
          <DialogTitle>Mover etiqueta</DialogTitle>
        </DialogHeader>
        <MoveTagForm
          tag={tag}
          categories={categories}
          currentCategoryId={currentCategoryId}
          onClose={close}
        />
      </DialogContent>
    </Dialog>
  );
}

function MoveTagForm({
  tag,
  categories,
  currentCategoryId,
  onClose,
}: {
  tag: CatalogTagDTO;
  categories: CategoryDTO[];
  currentCategoryId: number;
  onClose: () => void;
}) {
  const [categoryId, setCategoryId] = useState<string>("");
  const [state, formAction, isPending] = useActionState(moveTagToCategory, {
    status: "idle",
  } satisfies CategoryActionState);

  useEffect(() => {
    if (state.status === "success") {
      onClose();
      toast.success(state.message);
    }
  }, [state, onClose]);

  const candidates = categories.filter((category) => category.id !== currentCategoryId);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="tagId" value={tag.id} />
      <p className="text-sm text-muted-foreground">
        &quot;{tag.name}&quot; pasará a la categoría que elijas.
      </p>
      <div className="flex flex-col gap-2">
        <Label htmlFor="move-tag-category">Categoría</Label>
        <Select value={categoryId} onValueChange={setCategoryId} disabled={isPending}>
          <SelectTrigger id="move-tag-category" className="w-full" autoFocus>
            <SelectValue placeholder="Selecciona categoría" />
          </SelectTrigger>
          <SelectContent>
            {candidates.map((category) => (
              <SelectItem key={category.id} value={String(category.id)}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="categoryId" value={categoryId} />
        {state.status === "error" ? (
          <p role="alert" className="text-sm text-red-600">
            {state.message}
          </p>
        ) : null}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending || categoryId === ""}>
          {isPending ? "Moviendo…" : "Mover"}
        </Button>
      </DialogFooter>
    </form>
  );
}
