"use server";

import { CreateMovement } from "@/application/movement/CreateMovement";
import { AccountNotFoundError } from "@/domain/account/AccountErrors";
import { InvalidMoneyError, InvalidMovementError } from "@/domain/movement/MovementErrors";
import { InactiveTagError, TagNotFoundError } from "@/domain/tag/TagErrors";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "../../db/client";
import { DrizzleAccountRepository } from "../../db/DrizzleAccountRepository";
import { DrizzleMovementRepository } from "../../db/DrizzleMovementRepository";
import { DrizzleTagRepository } from "../../db/DrizzleTagRepository";
import {
  extractMovementFormData,
  movementFormSchema,
  parseAmountToCents,
  toMovementFormValues,
  type MovementFieldErrors,
  type MovementFormValues,
} from "./movement-form.schema";

export type {
  MovementFieldErrors as CreateMovementFieldErrors,
  MovementFieldKey as CreateMovementFieldKey,
  MovementFormValues as CreateMovementFormValues,
} from "./movement-form.schema";

export type CreateMovementState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; errors: MovementFieldErrors; values: MovementFormValues };

function mapDomainErrors(error: unknown): MovementFieldErrors {
  if (error instanceof InvalidMovementError) {
    return { [error.field]: [error.message] };
  }
  if (error instanceof InvalidMoneyError) {
    return { amount: [error.message] };
  }
  if (error instanceof AccountNotFoundError) {
    return { accountId: ["Selecciona una cuenta."] };
  }
  if (error instanceof InactiveTagError || error instanceof TagNotFoundError) {
    return { tagIds: ["Una de las etiquetas seleccionadas ya no está disponible."] };
  }
  return { _form: ["No se ha podido guardar el movimiento. Inténtalo de nuevo."] };
}

const createMovementUseCase = new CreateMovement(
  new DrizzleMovementRepository(db),
  new DrizzleAccountRepository(db),
  new DrizzleTagRepository(db),
);

export async function createMovement(
  _prevState: CreateMovementState,
  formData: FormData,
): Promise<CreateMovementState> {
  const raw = extractMovementFormData(formData);
  const parsed = movementFormSchema.safeParse(raw);

  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors as MovementFieldErrors;
    return { status: "error", errors: fieldErrors, values: toMovementFormValues(raw) };
  }

  const data = parsed.data;

  try {
    await createMovementUseCase.execute({
      accountId: data.accountId,
      type: data.type,
      date: data.date,
      concept: data.concept,
      description: data.description,
      amountCents: parseAmountToCents(data.amount.trim()),
      nature: data.nature ?? null,
      tagIds: data.tagIds,
    });

    revalidatePath("/");
    return { status: "success", message: "Movimiento guardado" };
  } catch (error) {
    return { status: "error", errors: mapDomainErrors(error), values: toMovementFormValues(raw) };
  }
}
