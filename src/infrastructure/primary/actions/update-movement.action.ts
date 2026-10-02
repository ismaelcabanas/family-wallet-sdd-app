"use server";

import { UpdateMovement } from "@/application/movement/UpdateMovement";
import { AccountNotFoundError } from "@/domain/account/AccountErrors";
import { MovementNotFoundError } from "@/domain/movement/MovementErrors";
import { InvalidMoneyError, InvalidMovementError } from "@/domain/movement/MovementErrors";
import { InactiveTagError, TagNotFoundError } from "@/domain/tag/TagErrors";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "../../db/client";
import { DrizzleAccountRepository } from "../../db/DrizzleAccountRepository";
import { DrizzleMovementRepository } from "../../db/DrizzleMovementRepository";
import { DrizzleTagRepository } from "../../db/DrizzleTagRepository";
import { monthYearLabel } from "../ui/format";
import {
  extractMovementFormData,
  movementFormSchema,
  parseAmountToCents,
  toMovementFormValues,
  type MovementFieldErrors,
  type MovementFormValues,
} from "./movement-form.schema";

export type UpdateMovementState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; errors: MovementFieldErrors; values: MovementFormValues };

const updateContextSchema = z.object({
  movementId: z.coerce.number().int().positive(),
  currentAccountId: z.coerce.number().int().positive(),
  currentMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
});

const UNEXPECTED_ERROR = "No se ha podido guardar el movimiento. Inténtalo de nuevo.";

function mapDomainErrors(error: unknown): MovementFieldErrors {
  if (error instanceof MovementNotFoundError) {
    return { _form: [error.message] };
  }
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
    return { tagId: ["Una de las etiquetas seleccionadas ya no está disponible."] };
  }
  return { _form: [UNEXPECTED_ERROR] };
}

function buildMovedNotice(
  message: string,
  finalMonth: string,
  currentMonth: string,
): string {
  if (finalMonth !== currentMonth) {
    return `${message}: ahora está en ${monthYearLabel(finalMonth)}`;
  }
  return message;
}

const updateMovementUseCase = new UpdateMovement(
  new DrizzleMovementRepository(db),
  new DrizzleAccountRepository(db),
  new DrizzleTagRepository(db),
);

export async function updateMovement(
  _prevState: UpdateMovementState,
  formData: FormData,
): Promise<UpdateMovementState> {
  const raw = extractMovementFormData(formData);
  const parsedForm = movementFormSchema.safeParse(raw);
  const parsedContext = updateContextSchema.safeParse({
    movementId: formData.get("movementId"),
    currentAccountId: formData.get("currentAccountId"),
    currentMonth: formData.get("currentMonth"),
  });

  if (!parsedForm.success) {
    const fieldErrors = z.flattenError(parsedForm.error).fieldErrors as MovementFieldErrors;
    return { status: "error", errors: fieldErrors, values: toMovementFormValues(raw) };
  }
  if (!parsedContext.success) {
    return { status: "error", errors: { _form: [UNEXPECTED_ERROR] }, values: toMovementFormValues(raw) };
  }

  const data = parsedForm.data;
  const context = parsedContext.data;

  try {
    await updateMovementUseCase.execute({
      movementId: context.movementId,
      expectedAccountId: context.currentAccountId,
      type: data.type,
      date: data.date,
      note: data.note,
      amountCents: parseAmountToCents(data.amount.trim()),
      nature: data.nature ?? null,
      tagId: data.tagId,
    });

    revalidatePath("/");
    revalidatePath("/accounts/[accountId]", "page");
    return {
      status: "success",
      message: buildMovedNotice("Movimiento actualizado", data.date.slice(0, 7), context.currentMonth),
    };
  } catch (error) {
    if (error instanceof MovementNotFoundError) {
      revalidatePath("/");
      revalidatePath("/accounts/[accountId]", "page");
    }
    return { status: "error", errors: mapDomainErrors(error), values: toMovementFormValues(raw) };
  }
}
