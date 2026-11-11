"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import type { MovementDTO, TagDTO } from "@/application/movement/dto";
import type { ActiveTagGroupDTO } from "@/application/tag/dto";
import { isProtectedTagSlug } from "@/domain/tag/SystemTags";

import { updateMovement, type UpdateMovementState } from "../actions/update-movement.action";
import { Button } from "./components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./components/ui/dialog";
import { MovementFormFields, type MovementFormInitialValues } from "./movement-form";

interface EditMovementDialogProps {
  movement: MovementDTO;
  tagGroups: ActiveTagGroupDTO[];
  currentAccountId: number;
  currentMonth: string;
  onClose: () => void;
}

const NOT_FOUND_MESSAGE = "El movimiento ya no existe.";

function mergeExtraTags(
  tagGroups: ActiveTagGroupDTO[],
  extraTags: TagDTO[],
): ActiveTagGroupDTO[] {
  const extras = extraTags.filter(
    (tag) => !tagGroups.some((group) => group.tags.some((candidate) => candidate.id === tag.id)),
  );
  if (extras.length === 0) return tagGroups;

  const groups = tagGroups.map((group) => ({ ...group, tags: [...group.tags] }));
  for (const tag of extras) {
    const target = groups.find((group) => group.category.id === tag.categoryId);
    if (target) {
      target.tags.push(tag);
    } else {
      groups.push({
        category: { id: tag.categoryId, name: tag.categoryName, isDefault: false },
        tags: [tag],
      });
    }
  }
  return groups;
}

export function EditMovementDialog({
  movement,
  tagGroups,
  currentAccountId,
  currentMonth,
  onClose,
}: EditMovementDialogProps) {
  const [open, setOpen] = useState(true);
  const [extraTags, setExtraTags] = useState<TagDTO[]>([]);

  const groupsWithExtras = mergeExtraTags(tagGroups, extraTags);

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
          <DialogTitle>Editar movimiento</DialogTitle>
        </DialogHeader>
        <EditMovementForm
          movement={movement}
          tagGroups={groupsWithExtras}
          currentAccountId={currentAccountId}
          currentMonth={currentMonth}
          onTagCreated={(tag) => {
            setExtraTags((current) =>
              current.some((t) => t.id === tag.id) ? current : [...current, tag],
            );
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

function EditMovementForm({
  movement,
  tagGroups,
  currentAccountId,
  currentMonth,
  onTagCreated,
  onClose,
}: Omit<EditMovementDialogProps, "onClose"> & {
  onTagCreated: (tag: TagDTO) => void;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState(updateMovement, {
    status: "idle",
  } satisfies UpdateMovementState);

  useEffect(() => {
    if (state.status === "success") {
      onClose();
      toast.success(state.message);
    }
    if (state.status === "error" && state.errors._form?.[0] === NOT_FOUND_MESSAGE) {
      onClose();
      toast.error(NOT_FOUND_MESSAGE);
    }
  }, [state, onClose]);

  const initialValues: MovementFormInitialValues = {
    date: movement.date,
    note: movement.note,
    amountCents: movement.amountCents,
    type: movement.type,
    nature: movement.nature,
    tagId: movement.tag?.id ?? null,
  };

  const isContribution =
    movement.tag !== null && isProtectedTagSlug(movement.tag.slug);

  return (
    <MovementFormFields
      state={state}
      formAction={formAction}
      isPending={isPending}
      tagGroups={tagGroups}
      initialValues={initialValues}
      contributionOption={isContribution ? "locked" : "off"}
      onTagCreated={onTagCreated}
      submitLabel="Guardar cambios"
      secondaryActions={
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
      }
    >
      <input type="hidden" name="movementId" value={movement.id} />
      <input type="hidden" name="currentAccountId" value={currentAccountId} />
      <input type="hidden" name="currentMonth" value={currentMonth} />
    </MovementFormFields>
  );
}
