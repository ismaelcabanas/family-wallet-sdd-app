"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import type { TagDTO } from "@/application/movement/dto";
import type { ExpenseNature } from "@/domain/movement/ExpenseNature";
import type { MovementType } from "@/domain/movement/MovementType";

import { createTag } from "../actions/create-tag.action";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { RadioGroup, RadioGroupItem } from "./components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";
import type {
  MovementFieldErrors,
  MovementFieldKey,
  MovementFormValues,
} from "../actions/movement-form.schema";
import { formatCentsForInput, todayIsoDate } from "./format";

export type MovementFormState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; errors: MovementFieldErrors; values: MovementFormValues };

export interface MovementFormInitialValues {
  date: string;
  note: string;
  amountCents: number;
  type: MovementType;
  nature: ExpenseNature | null;
  tagId: number | null;
}

export interface CarryOverValues {
  date: string;
  type: MovementType;
  nature: ExpenseNature | null;
}

interface MovementFormFieldsProps {
  state: MovementFormState;
  formAction: (formData: FormData) => void | Promise<void>;
  isPending: boolean;
  tags: TagDTO[];
  submitLabel?: string;
  primaryIntent?: "continue";
  secondaryActions?: ReactNode;
  children?: ReactNode;
  accountId?: number;
  accountType?: "personal" | "shared";
  initialValues?: MovementFormInitialValues;
  carry?: CarryOverValues;
  onTagCreated?: (tag: TagDTO) => void;
}

const NO_TAG_VALUE = "__no_tag__";

export function MovementFormFields({
  state,
  formAction,
  isPending,
  tags,
  submitLabel = "Registrar",
  primaryIntent,
  secondaryActions,
  children,
  accountId,
  accountType,
  initialValues,
  carry,
  onTagCreated,
}: MovementFormFieldsProps) {
  const isEditMode = Boolean(initialValues && !carry);

  const initialType =
    state.status === "error" && state.values.type === "income"
      ? ("income" as const)
      : (initialValues?.type ?? carry?.type ?? ("expense" as const));
  const initialNature =
    initialValues?.nature ??
    (carry?.type === "expense" ? carry.nature : null) ??
    "personal";

  const [chosenType, setChosenType] = useState<MovementType>(initialType);
  const [chosenNature, setChosenNature] = useState<ExpenseNature>(initialNature);
  const [selectedTagId, setSelectedTagId] = useState<string>(
    initialValues?.tagId != null ? String(initialValues.tagId) : "",
  );

  const noteRef = useRef<HTMLInputElement>(null);
  const tagNameInputRef = useRef<HTMLInputElement>(null);
  const tagSelectRef = useRef<HTMLButtonElement>(null);

  const [creatingTag, setCreatingTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [tagNameError, setTagNameError] = useState<string | null>(null);
  const [createdTags, setCreatedTags] = useState<TagDTO[]>([]);
  const [focusTagSelectAfterCreation, setFocusTagSelectAfterCreation] = useState(false);
  const [isCreatingTag, startTagCreation] = useTransition();

  useEffect(() => {
    if (carry && noteRef.current) {
      noteRef.current.focus();
    }
  }, [carry]);

  useEffect(() => {
    if (creatingTag && tagNameInputRef.current) {
      tagNameInputRef.current.focus();
    }
  }, [creatingTag]);

  useEffect(() => {
    if (focusTagSelectAfterCreation && tagSelectRef.current) {
      setFocusTagSelectAfterCreation(false);
      tagSelectRef.current.focus();
    }
  }, [focusTagSelectAfterCreation]);

  function openTagCreation() {
    setNewTagName("");
    setTagNameError(null);
    setCreatingTag(true);
  }

  function closeTagCreation() {
    setCreatingTag(false);
    setNewTagName("");
    setTagNameError(null);
  }

  function submitTagCreation() {
    if (isCreatingTag || isPending) return;
    const name = newTagName.trim();
    if (name === "") {
      setTagNameError("El nombre de la etiqueta es obligatorio.");
      return;
    }
    startTagCreation(async () => {
      const result = await createTag(name);
      if (!result.ok) {
        setTagNameError(result.message);
        return;
      }
      toast.success("Etiqueta creada");
      setCreatedTags((current) => [...current, result.tag]);
      setCreatingTag(false);
      setNewTagName("");
      setTagNameError(null);
      setSelectedTagId(String(result.tag.id));
      onTagCreated?.(result.tag);
      setFocusTagSelectAfterCreation(true);
    });
  }

  const isSharedAccount = accountType === "shared" && !isEditMode;

  const errorTagId =
    state.status === "error" && state.values.tagId !== "" ? state.values.tagId : undefined;

  const fieldError = (field: MovementFieldKey): string | undefined =>
    state.status === "error" ? state.errors[field]?.[0] : undefined;

  const fieldValue = (field: "date" | "note" | "amount", fallback: string) =>
    state.status === "error" ? (state.values[field] ?? fallback) : fallback;

  const natureError = fieldError("nature");
  const idPrefix = isEditMode ? "edit-" : "";

  function defaultDate(): string {
    if (initialValues) return initialValues.date;
    if (carry) return carry.date;
    return todayIsoDate();
  }

  function defaultAmount(): string {
    if (initialValues) return formatCentsForInput(initialValues.amountCents);
    return "";
  }

  function defaultNature(): ExpenseNature {
    if (isSharedAccount) return "shared";
    if (state.status === "error" && state.values.nature !== "") {
      return state.values.nature as ExpenseNature;
    }
    if (carry?.type === "expense" && carry.nature !== null) return carry.nature;
    return "personal";
  }

  const selectValue =
    state.status === "error" && errorTagId !== undefined
      ? errorTagId
      : selectedTagId === ""
        ? undefined
        : selectedTagId;

  const createdTag =
    selectedTagId !== "" && !tags.some((tag) => String(tag.id) === selectedTagId)
      ? createdTags.find((tag) => String(tag.id) === selectedTagId)
      : undefined;
  const selectTags = createdTag ? [...tags, createdTag] : tags;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {children}
      {isEditMode ? null : <input type="hidden" name="accountId" value={accountId} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}movement-date`}>Fecha</Label>
          <Input
            id={`${idPrefix}movement-date`}
            name="date"
            type="date"
            defaultValue={fieldValue("date", defaultDate())}
            aria-describedby={fieldError("date") ? `${idPrefix}movement-date-error` : undefined}
          />
          {fieldError("date") ? (
            <p role="alert" id={`${idPrefix}movement-date-error`} className="text-sm text-red-600">
              {fieldError("date")}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}movement-amount`}>Importe (€)</Label>
          <Input
            id={`${idPrefix}movement-amount`}
            name="amount"
            inputMode="decimal"
            placeholder="0,00"
            defaultValue={fieldValue("amount", defaultAmount())}
            aria-describedby={fieldError("amount") ? `${idPrefix}movement-amount-error` : undefined}
          />
          {fieldError("amount") ? (
            <p role="alert" id={`${idPrefix}movement-amount-error`} className="text-sm text-red-600">
              {fieldError("amount")}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}movement-note`}>Nota</Label>
        <Input
          ref={noteRef}
          id={`${idPrefix}movement-note`}
          name="note"
          placeholder="Mercadona"
          defaultValue={fieldValue("note", initialValues?.note ?? "")}
          aria-describedby={fieldError("note") ? `${idPrefix}movement-note-error` : undefined}
        />
        {fieldError("note") ? (
          <p role="alert" id={`${idPrefix}movement-note-error`} className="text-sm text-red-600">
            {fieldError("note")}
          </p>
        ) : null}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Tipo</legend>
        <RadioGroup
          name="type"
          value={chosenType}
          onValueChange={(value) => setChosenType(value as MovementType)}
          className="flex gap-6"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="expense" id={`${idPrefix}movement-type-expense`} />
            <Label htmlFor={`${idPrefix}movement-type-expense`}>Gasto</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="income" id={`${idPrefix}movement-type-income`} />
            <Label htmlFor={`${idPrefix}movement-type-income`}>Ingreso</Label>
          </div>
        </RadioGroup>
        {fieldError("type") ? (
          <p role="alert" className="text-sm text-red-600">
            {fieldError("type")}
          </p>
        ) : null}
      </fieldset>

      {chosenType === "expense" ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Naturaleza del gasto</legend>
          {isSharedAccount ? (
            <>
              <input type="hidden" name="nature" value="shared" />
              <RadioGroup value="shared" disabled className="flex gap-6">
                <div className="flex items-center gap-2 opacity-60">
                  <RadioGroupItem value="personal" id={`${idPrefix}movement-nature-personal`} disabled />
                  <Label htmlFor={`${idPrefix}movement-nature-personal`}>Personal</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="shared" id={`${idPrefix}movement-nature-shared`} disabled />
                  <Label htmlFor={`${idPrefix}movement-nature-shared`}>
                    Compartido (fijo en la cuenta común)
                  </Label>
                </div>
              </RadioGroup>
            </>
          ) : isEditMode || state.status === "error" ? (
            <RadioGroup
              name="nature"
              value={
                state.status === "error" && state.values.nature !== ""
                  ? (state.values.nature as ExpenseNature)
                  : chosenNature
              }
              onValueChange={(value) => setChosenNature(value as ExpenseNature)}
              className="flex gap-6"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="personal" id={`${idPrefix}movement-nature-personal`} />
                <Label htmlFor={`${idPrefix}movement-nature-personal`}>Personal</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="shared" id={`${idPrefix}movement-nature-shared`} />
                <Label htmlFor={`${idPrefix}movement-nature-shared`}>Compartido</Label>
              </div>
            </RadioGroup>
          ) : (
            <RadioGroup name="nature" defaultValue={defaultNature()} className="flex gap-6">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="personal" id={`${idPrefix}movement-nature-personal`} />
                <Label htmlFor={`${idPrefix}movement-nature-personal`}>Personal</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="shared" id={`${idPrefix}movement-nature-shared`} />
                <Label htmlFor={`${idPrefix}movement-nature-shared`}>Compartido</Label>
              </div>
            </RadioGroup>
          )}
          {natureError ? (
            <p role="alert" id="movement-nature-error" className="text-sm text-red-600">
              {natureError}
            </p>
          ) : null}
        </fieldset>
      ) : null}

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <Label htmlFor={`${idPrefix}movement-tag`}>Etiqueta</Label>
          {creatingTag ? null : (
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-sm"
              onClick={openTagCreation}
              disabled={isPending || isCreatingTag}
            >
              + Nueva etiqueta
            </Button>
          )}
        </div>
        {creatingTag ? (
          <>
            <Input
              ref={tagNameInputRef}
              id={`${idPrefix}new-tag-name`}
              data-tag-creation-input="true"
              value={newTagName}
              onChange={(event) => setNewTagName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.stopPropagation();
                  submitTagCreation();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  closeTagCreation();
                }
              }}
              placeholder="Mascotas"
              aria-label="Nombre de la etiqueta"
              aria-invalid={tagNameError ? true : undefined}
              aria-describedby={tagNameError ? `${idPrefix}new-tag-name-error` : undefined}
              disabled={isPending || isCreatingTag}
            />
            {tagNameError ? (
              <p
                role="alert"
                id={`${idPrefix}new-tag-name-error`}
                className="text-sm text-red-600"
              >
                {tagNameError}
              </p>
            ) : null}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={closeTagCreation}
                disabled={isPending || isCreatingTag}
              >
                Cancelar
              </Button>
              <Button type="button" onClick={submitTagCreation} disabled={isPending || isCreatingTag}>
                {isCreatingTag ? "Creando…" : "Crear"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <input
              type="hidden"
              name="tagId"
              value={selectValue === NO_TAG_VALUE ? "" : (selectValue ?? "")}
            />
            <Select value={selectValue} onValueChange={(value) => setSelectedTagId(value)}>
              <SelectTrigger
                ref={tagSelectRef}
                id={`${idPrefix}movement-tag`}
                className="w-full"
                aria-label="Etiqueta"
              >
                <SelectValue placeholder="Selecciona etiqueta" />
              </SelectTrigger>
              <SelectContent>
                {chosenType === "income" ? (
                  <SelectItem value={NO_TAG_VALUE}>Sin etiqueta</SelectItem>
                ) : null}
                {selectTags.map((tag) => (
                  <SelectItem key={tag.id} value={String(tag.id)}>
                    {tag.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldError("tagId") ? (
              <p role="alert" id={`${idPrefix}movement-tag-error`} className="text-sm text-red-600">
                {fieldError("tagId")}
              </p>
            ) : null}
          </>
        )}
      </div>

      {state.status === "error" && state.errors._form ? (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-600">
          {state.errors._form[0]}
        </p>
      ) : null}

      <div className="flex items-center gap-2 self-start">
        {secondaryActions}
        <Button
          type="submit"
          disabled={isPending}
          {...(primaryIntent === "continue" ? { name: "intent", value: "continue" } : {})}
        >
          {isPending ? "Guardando…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
