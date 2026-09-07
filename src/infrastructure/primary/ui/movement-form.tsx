"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import type { TagDTO } from "@/application/movement/dto";

import { Button } from "./components/ui/button";
import { Checkbox } from "./components/ui/checkbox";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { RadioGroup, RadioGroupItem } from "./components/ui/radio-group";
import {
  createMovement,
  type CreateMovementFieldKey,
  type CreateMovementState,
} from "../actions/create-movement.action";
import { todayIsoDate } from "./format";

interface MovementFormProps {
  accountId: number;
  accountName: string;
  accountType: "personal" | "shared";
  tags: TagDTO[];
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

function MovementFormFields({
  state,
  formAction,
  isPending,
  accountId,
  accountName,
  accountType,
  tags,
}: MovementFormProps & {
  state: CreateMovementState;
  formAction: (formData: FormData) => void | Promise<void>;
  isPending: boolean;
}) {
  const [chosenType, setChosenType] = useState<"expense" | "income">(
    state.status === "error" && state.values.type === "income" ? "income" : "expense",
  );

  const isSharedAccount = accountType === "shared";
  const selectedTagIds = state.status === "error" ? state.values.tagIds : [];
  const defaultNature = isSharedAccount
    ? "shared"
    : state.status === "error" && state.values.nature !== ""
      ? state.values.nature
      : "personal";

  const fieldError = (field: CreateMovementFieldKey): string | undefined =>
    state.status === "error" ? state.errors[field]?.[0] : undefined;

  const fieldValue = (field: "date" | "concept" | "description" | "amount", fallback: string) =>
    state.status === "error" ? (state.values[field] ?? fallback) : fallback;

  const natureError = fieldError("nature");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="accountId" value={accountId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="movement-date">Fecha</Label>
          <Input
            id="movement-date"
            name="date"
            type="date"
            defaultValue={fieldValue("date", todayIsoDate())}
            aria-describedby={fieldError("date") ? "movement-date-error" : undefined}
          />
          {fieldError("date") ? (
            <p role="alert" id="movement-date-error" className="text-sm text-red-600">
              {fieldError("date")}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="movement-amount">Importe (€)</Label>
          <Input
            id="movement-amount"
            name="amount"
            inputMode="decimal"
            placeholder="0,00"
            defaultValue={fieldValue("amount", "")}
            aria-describedby={fieldError("amount") ? "movement-amount-error" : undefined}
          />
          {fieldError("amount") ? (
            <p role="alert" id="movement-amount-error" className="text-sm text-red-600">
              {fieldError("amount")}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="movement-concept">Concepto</Label>
        <Input
          id="movement-concept"
          name="concept"
          placeholder="Mercadona"
          defaultValue={fieldValue("concept", "")}
          aria-describedby={fieldError("concept") ? "movement-concept-error" : undefined}
        />
        {fieldError("concept") ? (
          <p role="alert" id="movement-concept-error" className="text-sm text-red-600">
            {fieldError("concept")}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="movement-description">Descripción (opcional)</Label>
        <Input
          id="movement-description"
          name="description"
          defaultValue={fieldValue("description", "")}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Cuenta</Label>
        <p className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
          {accountName} (se cambia con el selector superior)
        </p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Tipo</legend>
        <RadioGroup
          name="type"
          value={chosenType}
          onValueChange={(value) => setChosenType(value as "expense" | "income")}
          className="flex gap-6"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="expense" id="movement-type-expense" />
            <Label htmlFor="movement-type-expense">Gasto</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="income" id="movement-type-income" />
            <Label htmlFor="movement-type-income">Ingreso</Label>
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
                  <RadioGroupItem value="personal" id="movement-nature-personal" disabled />
                  <Label htmlFor="movement-nature-personal">Personal</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="shared" id="movement-nature-shared" disabled />
                  <Label htmlFor="movement-nature-shared">
                    Compartido (fijo en la cuenta común)
                  </Label>
                </div>
              </RadioGroup>
            </>
          ) : (
            <RadioGroup name="nature" defaultValue={defaultNature} className="flex gap-6">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="personal" id="movement-nature-personal" />
                <Label htmlFor="movement-nature-personal">Personal</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="shared" id="movement-nature-shared" />
                <Label htmlFor="movement-nature-shared">Compartido</Label>
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
                  id={`movement-tag-${tag.id}`}
                  key={`${tag.id}-${checked ? "on" : "off"}`}
                  name="tagIds"
                  value={String(tag.id)}
                  defaultChecked={checked}
                />
                <Label htmlFor={`movement-tag-${tag.id}`} className="font-normal">
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

      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? "Guardando…" : "Registrar"}
      </Button>
    </form>
  );
}
