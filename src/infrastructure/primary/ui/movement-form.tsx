"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import type { AccountDTO, TagDTO } from "@/application/movement/dto";
import type { ExpenseNature } from "@/domain/movement/ExpenseNature";

import { Button } from "./components/ui/button";
import { Checkbox } from "./components/ui/checkbox";
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
import {
  createMovement,
  type CreateMovementState,
} from "../actions/create-movement.action";
import type {
  MovementFieldErrors,
  MovementFieldKey,
  MovementFormValues,
} from "../actions/movement-form.schema";
import { formatCentsForInput, todayIsoDate } from "./format";

interface MovementFormProps {
  accountId: number;
  accountName: string;
  accountType: "personal" | "shared";
  tags: TagDTO[];
}

export type MovementFormState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; errors: MovementFieldErrors; values: MovementFormValues };

export interface MovementFormInitialValues {
  date: string;
  concept: string;
  description: string;
  amountCents: number;
  accountId: number;
  type: "expense" | "income";
  nature: ExpenseNature | null;
  tagIds: number[];
}

export function MovementForm(props: MovementFormProps) {
  const [state, formAction, isPending] = useActionState(createMovement, {
    status: "idle",
  } satisfies CreateMovementState);

  const [successCount, setSuccessCount] = useState(0);
  const [lastSeenState, setLastSeenState] = useState(state);
  if (lastSeenState !== state) {
    setLastSeenState(state);
    if (state.status === "success") {
      setSuccessCount((count) => count + 1);
    }
  }
  const formKey = state.status === "success" ? `success-${successCount}` : "form";

  useEffect(() => {
    if (state.status === "success") {
      toast.success("Movimiento guardado");
    }
  }, [state]);

  return (
    <section aria-labelledby="movement-form-title" className="rounded-lg border p-4">
      <h2 id="movement-form-title" className="mb-4 text-lg font-semibold">
        Registrar movimiento
      </h2>
      <MovementFormFields
        key={formKey}
        state={state}
        formAction={formAction}
        isPending={isPending}
        {...props}
      />
    </section>
  );
}

interface MovementFormFieldsProps {
  state: MovementFormState;
  formAction: (formData: FormData) => void | Promise<void>;
  isPending: boolean;
  tags: TagDTO[];
  submitLabel?: string;
  secondaryActions?: ReactNode;
  children?: ReactNode;
  accountId?: number;
  accountName?: string;
  accountType?: "personal" | "shared";
  accounts?: AccountDTO[];
  initialValues?: MovementFormInitialValues;
}

export function MovementFormFields({
  state,
  formAction,
  isPending,
  tags,
  submitLabel = "Registrar",
  secondaryActions,
  children,
  accountId,
  accountName,
  accountType,
  accounts,
  initialValues,
}: MovementFormFieldsProps) {
  const isEditMode = Boolean(accounts && initialValues);

  const [chosenType, setChosenType] = useState<"expense" | "income">(
    state.status === "error" && state.values.type === "income"
      ? "income"
      : (initialValues?.type ?? "expense"),
  );
  const [chosenNature, setChosenNature] = useState<ExpenseNature>(
    initialValues?.nature ?? "personal",
  );
  const [chosenAccountId, setChosenAccountId] = useState<number>(
    initialValues?.accountId ?? 0,
  );

  const isSharedAccount = isEditMode
    ? (accounts?.find((account) => account.id === effectiveAccountId())?.type ?? "personal") ===
      "shared"
    : accountType === "shared";

  const selectedTagIds =
    state.status === "error"
      ? state.values.tagIds
      : (initialValues?.tagIds.map(String) ?? []);
  const defaultNature = isSharedAccount
    ? "shared"
    : state.status === "error" && state.values.nature !== ""
      ? state.values.nature
      : "personal";

  const fieldError = (field: MovementFieldKey): string | undefined =>
    state.status === "error" ? state.errors[field]?.[0] : undefined;

  const fieldValue = (field: "date" | "concept" | "description" | "amount", fallback: string) =>
    state.status === "error" ? (state.values[field] ?? fallback) : fallback;

  const natureError = fieldError("nature");
  const idPrefix = isEditMode ? "edit-" : "";

  function effectiveAccountId(): number {
    if (state.status === "error") return Number(state.values.accountId);
    return chosenAccountId;
  }

  function editFallback(field: "date" | "concept" | "description" | "amount"): string {
    if (!initialValues) return field === "date" ? todayIsoDate() : "";
    switch (field) {
      case "date":
        return initialValues.date;
      case "concept":
        return initialValues.concept;
      case "description":
        return initialValues.description;
      case "amount":
        return formatCentsForInput(initialValues.amountCents);
    }
  }

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
            defaultValue={fieldValue("date", editFallback("date"))}
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
            defaultValue={fieldValue("amount", editFallback("amount"))}
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
        <Label htmlFor={`${idPrefix}movement-concept`}>Concepto</Label>
        <Input
          id={`${idPrefix}movement-concept`}
          name="concept"
          placeholder="Mercadona"
          defaultValue={fieldValue("concept", editFallback("concept"))}
          aria-describedby={fieldError("concept") ? `${idPrefix}movement-concept-error` : undefined}
        />
        {fieldError("concept") ? (
          <p role="alert" id={`${idPrefix}movement-concept-error`} className="text-sm text-red-600">
            {fieldError("concept")}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}movement-description`}>Descripción (opcional)</Label>
        <Input
          id={`${idPrefix}movement-description`}
          name="description"
          defaultValue={fieldValue("description", editFallback("description"))}
        />
      </div>

      {isEditMode ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}movement-account`}>Cuenta</Label>
          <Select
            name="accountId"
            value={String(effectiveAccountId())}
            onValueChange={(value) => setChosenAccountId(Number(value))}
          >
            <SelectTrigger id={`${idPrefix}movement-account`} className="w-full" aria-label="Cuenta">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {accounts?.map((account) => (
                <SelectItem key={account.id} value={String(account.id)}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldError("accountId") ? (
            <p role="alert" className="text-sm text-red-600">
              {fieldError("accountId")}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Label>Cuenta</Label>
          <p className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
            {accountName} (se cambia con el selector superior)
          </p>
        </div>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Tipo</legend>
        <RadioGroup
          name="type"
          value={chosenType}
          onValueChange={(value) => setChosenType(value as "expense" | "income")}
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
          ) : isEditMode ? (
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
            <RadioGroup name="nature" defaultValue={defaultNature} className="flex gap-6">
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

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Etiquetas (opcional)</legend>
        <div className="flex flex-wrap gap-3">
          {tags.map((tag) => {
            const checked = selectedTagIds.includes(String(tag.id));
            return (
              <div key={tag.id} className="flex items-center gap-2">
                <Checkbox
                  id={`${idPrefix}movement-tag-${tag.id}`}
                  key={`${tag.id}-${checked ? "on" : "off"}`}
                  name="tagIds"
                  value={String(tag.id)}
                  defaultChecked={checked}
                />
                <Label htmlFor={`${idPrefix}movement-tag-${tag.id}`} className="font-normal">
                  {tag.name}
                </Label>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Sin selección, el movimiento se guarda con la etiqueta «Sin Clasificar».
        </p>
        {fieldError("tagIds") ? (
          <p role="alert" className="text-sm text-red-600">
            {fieldError("tagIds")}
          </p>
        ) : null}
      </fieldset>

      {state.status === "error" && state.errors._form ? (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-600">
          {state.errors._form[0]}
        </p>
      ) : null}

      <div className="flex items-center gap-2 self-start">
        {secondaryActions}
        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
