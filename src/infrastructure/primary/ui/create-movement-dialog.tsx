"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { TagDTO } from "@/application/movement/dto";
import type { ExpenseNature } from "@/domain/movement/ExpenseNature";
import type { MovementType } from "@/domain/movement/MovementType";

import {
  createMovement,
  type CreateMovementState,
} from "../actions/create-movement.action";
import { Button } from "./components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./components/ui/dialog";
import { MovementFormFields, type CarryOverValues } from "./movement-form";

interface CreateMovementDialogProps {
  accountId: number;
  accountName: string;
  accountType: "personal" | "shared";
  tags: TagDTO[];
  onClose: () => void;
}

export function CreateMovementDialog({
  accountId,
  accountName: _accountName,
  accountType,
  tags,
  onClose,
}: CreateMovementDialogProps) {
  void _accountName;
  const [open, setOpen] = useState(true);
  const [savedCount, setSavedCount] = useState(0);
  const [carry, setCarry] = useState<CarryOverValues | null>(null);
  const [extraTags, setExtraTags] = useState<TagDTO[]>([]);

  const allTags = [...tags, ...extraTags.filter((tag) => !tags.some((t) => t.id === tag.id))].sort(
    (a, b) => a.name.localeCompare(b.name, "es"),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
        setOpen(nextOpen);
      }}
    >
      <DialogContent
        onEscapeKeyDown={(event) => {
          if (document.activeElement?.getAttribute("data-tag-creation-input") === "true") {
            event.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Nuevo movimiento</DialogTitle>
          {savedCount > 0 ? (
            <p className="text-sm text-muted-foreground">Guardados: {savedCount}</p>
          ) : null}
        </DialogHeader>
        <CreateMovementForm
          key={savedCount}
          accountId={accountId}
          accountType={accountType}
          tags={allTags}
          carry={carry}
          onTagCreated={(tag) => {
            setExtraTags((current) =>
              current.some((t) => t.id === tag.id) ? current : [...current, tag],
            );
          }}
          onSaved={(nextCarry) => {
            setSavedCount((count) => count + 1);
            setCarry(nextCarry);
          }}
          onClose={() => {
            setOpen(false);
            onClose();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function CreateMovementForm({
  accountId,
  accountType,
  tags,
  carry,
  onTagCreated,
  onSaved,
  onClose,
}: Omit<CreateMovementDialogProps, "onClose" | "accountName"> & {
  carry: CarryOverValues | null;
  onTagCreated: (tag: TagDTO) => void;
  onSaved: (carry: CarryOverValues) => void;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState(createMovement, {
    status: "idle",
  } satisfies CreateMovementState);

  const lastSubmittedRef = useRef<FormData | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    if (state.status !== "success" || handledRef.current) return;
    handledRef.current = true;
    toast.success(state.message);
    if (state.intent === "continue") {
      const formData = lastSubmittedRef.current;
      if (formData) {
        const type = (formData.get("type") as MovementType) ?? "expense";
        const nature =
          type === "expense" ? ((formData.get("nature") as ExpenseNature) ?? "personal") : null;
        onSaved({ date: String(formData.get("date") ?? ""), type, nature });
      }
      return;
    }
    onClose();
  }, [state, onSaved, onClose]);

  return (
    <MovementFormFields
      state={state}
      formAction={(formData) => {
        lastSubmittedRef.current = formData;
        return formAction(formData);
      }}
      isPending={isPending}
      tags={tags}
      accountId={accountId}
      accountType={accountType}
      carry={carry ?? undefined}
      onTagCreated={onTagCreated}
      submitLabel="Guardar y seguir"
      primaryIntent="continue"
      secondaryActions={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            type="submit"
            name="intent"
            value="close"
            variant="outline"
            disabled={isPending}
          >
            {isPending ? "Guardando…" : "Guardar y cerrar"}
          </Button>
        </>
      }
    />
  );
}
