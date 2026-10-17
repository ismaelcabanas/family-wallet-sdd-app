"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import type { CatalogTagDTO } from "@/application/tag/dto";

import { mergeTags, type TagActionState } from "../actions/merge-tags.action";
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

interface MergeTagsDialogProps {
  tag: CatalogTagDTO;
  tags: CatalogTagDTO[];
  onClose: () => void;
}

export function MergeTagsDialog({ tag, tags, onClose }: MergeTagsDialogProps) {
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
          <DialogTitle>Fusionar etiqueta</DialogTitle>
        </DialogHeader>
        <MergeTagsForm tag={tag} tags={tags} onClose={close} />
      </DialogContent>
    </Dialog>
  );
}

function MergeTagsForm({
  tag,
  tags,
  onClose,
}: {
  tag: CatalogTagDTO;
  tags: CatalogTagDTO[];
  onClose: () => void;
}) {
  const [targetId, setTargetId] = useState<string>("");
  const [state, formAction, isPending] = useActionState(mergeTags, {
    status: "idle",
  } satisfies TagActionState);

  useEffect(() => {
    if (state.status === "success") {
      onClose();
      toast.success(state.message);
    }
  }, [state, onClose]);

  const candidates = tags.filter(
    (candidate) => candidate.id !== tag.id && !candidate.isProtected,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="absorbedId" value={tag.id} />
      <p className="text-sm text-muted-foreground">
        Los movimientos con la etiqueta &quot;{tag.name}&quot; pasarán a la etiqueta que
        elijas. &quot;{tag.name}&quot; desaparecerá del catálogo.
      </p>
      <div className="flex flex-col gap-2">
        <Label htmlFor="merge-tags-target">Etiqueta resultante</Label>
        <Select value={targetId} onValueChange={setTargetId} disabled={isPending}>
          <SelectTrigger id="merge-tags-target" className="w-full" autoFocus>
            <SelectValue placeholder="Selecciona etiqueta" />
          </SelectTrigger>
          <SelectContent>
            {candidates.map((candidate) => (
              <SelectItem key={candidate.id} value={String(candidate.id)}>
                {candidate.status === "inactive"
                  ? `${candidate.name} (inactiva)`
                  : candidate.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="targetId" value={targetId} />
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
        <Button type="submit" variant="destructive" disabled={isPending || targetId === ""}>
          {isPending ? "Fusionando…" : "Fusionar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
