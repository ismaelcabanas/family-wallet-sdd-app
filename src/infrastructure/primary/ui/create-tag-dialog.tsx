"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { CategoryDTO } from "@/application/tag-category/dto";

import { createTagEntry, type TagEntryActionState } from "../actions/create-tag-entry.action";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";

interface CreateTagDialogProps {
  categories: CategoryDTO[];
  onClose: () => void;
}

const NO_CATEGORY_VALUE = "__no_category__";

export function CreateTagDialog({ categories, onClose }: CreateTagDialogProps) {
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
          <DialogTitle>Nueva etiqueta</DialogTitle>
        </DialogHeader>
        <CreateTagForm categories={categories} onClose={close} />
      </DialogContent>
    </Dialog>
  );
}

function CreateTagForm({
  categories,
  onClose,
}: {
  categories: CategoryDTO[];
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const lastSelectedCategoryIdRef = useRef("");
  const [state, formAction, isPending] = useActionState(createTagEntry, {
    status: "idle",
  } satisfies TagEntryActionState);

  useEffect(() => {
    if (state.status === "success") {
      onClose();
      toast.success(state.message);
    }
  }, [state, onClose]);

  useEffect(() => {
    if (state.status === "error" && categoryId === "" && lastSelectedCategoryIdRef.current !== "") {
      setCategoryId(lastSelectedCategoryIdRef.current);
    }
  }, [state, categoryId]);

  function handleCategoryChange(value: string) {
    if (value !== "") {
      lastSelectedCategoryIdRef.current = value === NO_CATEGORY_VALUE ? "" : value;
    }
    setCategoryId(value);
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="create-tag-name">Nombre</Label>
        <Input
          id="create-tag-name"
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
          disabled={isPending}
          aria-describedby={state.status === "error" ? "create-tag-error" : undefined}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="create-tag-category">Categoría</Label>
        <Select value={categoryId} onValueChange={handleCategoryChange} disabled={isPending}>
          <SelectTrigger id="create-tag-category" className="w-full">
            <SelectValue placeholder="Ninguna — se creará una categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_CATEGORY_VALUE}>Ninguna — se creará una categoría</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={String(category.id)}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input
          type="hidden"
          name="categoryId"
          value={categoryId === NO_CATEGORY_VALUE ? "" : categoryId}
        />
        {state.status === "error" ? (
          <p role="alert" id="create-tag-error" className="text-sm text-red-600">
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
