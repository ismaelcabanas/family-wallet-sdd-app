"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { ActiveTagGroupDTO } from "@/application/tag/dto";
import { isProtectedTagSlug } from "@/domain/tag/SystemTags";

import { bulkRetag, type BulkRetagActionState } from "../actions/bulk-retag.action";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";

interface BulkRetagDialogProps {
  accountId: number;
  month: string;
  movementIds: number[];
  tagGroups: ActiveTagGroupDTO[];
  onClose: () => void;
  onSuccess: () => void;
}

export function BulkRetagDialog({
  accountId,
  month,
  movementIds,
  tagGroups,
  onClose,
  onSuccess,
}: BulkRetagDialogProps) {
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
          <DialogTitle>Cambiar etiqueta</DialogTitle>
        </DialogHeader>
        <BulkRetagForm
          accountId={accountId}
          month={month}
          movementIds={movementIds}
          tagGroups={tagGroups}
          onClose={close}
          onSuccess={onSuccess}
        />
      </DialogContent>
    </Dialog>
  );
}

function BulkRetagForm({
  accountId,
  month,
  movementIds,
  tagGroups,
  onClose,
  onSuccess,
}: {
  accountId: number;
  month: string;
  movementIds: number[];
  tagGroups: ActiveTagGroupDTO[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [targetTagId, setTargetTagId] = useState("");
  const lastSelectedTagIdRef = useRef("");
  const handledRef = useRef(false);
  const [state, formAction, isPending] = useActionState(bulkRetag, {
    status: "idle",
  } satisfies BulkRetagActionState);

  useEffect(() => {
    if (state.status !== "success" || handledRef.current) return;
    handledRef.current = true;
    toast.success(state.message);
    onClose();
    onSuccess();
  }, [state, onClose, onSuccess]);

  useEffect(() => {
    if (state.status === "error" && targetTagId === "" && lastSelectedTagIdRef.current !== "") {
      setTargetTagId(lastSelectedTagIdRef.current);
    }
  }, [state, targetTagId]);

  function handleTargetChange(value: string) {
    if (value !== "") {
      lastSelectedTagIdRef.current = value;
    }
    setTargetTagId(value);
  }

  const selectableGroups = tagGroups
    .map((group) => ({
      ...group,
      tags: group.tags.filter((tag) => !isProtectedTagSlug(tag.slug)),
    }))
    .filter((group) => group.tags.length > 0);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="month" value={month} />
      {movementIds.map((id) => (
        <input key={id} type="hidden" name="movementIds" value={id} />
      ))}
      <p className="text-sm text-muted-foreground">
        Se cambiará la etiqueta de {movementIds.length} movimientos.
      </p>
      <div className="flex flex-col gap-2">
        <Label htmlFor="bulk-retag-target">Nueva etiqueta</Label>
        <Select value={targetTagId} onValueChange={handleTargetChange} disabled={isPending}>
          <SelectTrigger id="bulk-retag-target" className="w-full">
            <SelectValue placeholder="Selecciona etiqueta" />
          </SelectTrigger>
          <SelectContent>
            {selectableGroups.map((group) => (
              <SelectGroup key={group.category.id}>
                <SelectLabel>{group.category.name}</SelectLabel>
                {group.tags.map((tag) => (
                  <SelectItem key={tag.id} value={String(tag.id)}>
                    {tag.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="targetTagId" value={targetTagId} />
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
        <Button type="submit" disabled={isPending || targetTagId === ""}>
          {isPending ? "Reasignando…" : "Reasignar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
