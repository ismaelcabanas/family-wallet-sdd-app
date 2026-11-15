"use server";

import { CreateMovement } from "@/application/movement/CreateMovement";
import { RegisterManualContribution } from "@/application/common-contribution/RegisterManualContribution";
import { RegisterManualSavings } from "@/application/savings/RegisterManualSavings";
import { AccountNotFoundError } from "@/domain/account/AccountErrors";
import {
  CommonContributionNotFoundError,
  ContributionAlreadyExistsError,
  SharedAccountContributionError,
} from "@/domain/common-contribution/CommonContributionErrors";
import { InvalidMoneyError, InvalidMovementError } from "@/domain/movement/MovementErrors";
import {
  SavingsAllocationNotFoundError,
  SavingsAlreadyExistsError,
  SharedAccountSavingsError,
} from "@/domain/savings/SavingsAllocationErrors";
import { InactiveTagError, TagNotFoundError } from "@/domain/tag/TagErrors";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "../../db/client";
import { DrizzleAccountRepository } from "../../db/DrizzleAccountRepository";
import { DrizzleCommonContributionRepository } from "../../db/DrizzleCommonContributionRepository";
import { DrizzleMovementRepository } from "../../db/DrizzleMovementRepository";
import { DrizzleSavingsAllocationRepository } from "../../db/DrizzleSavingsAllocationRepository";
import { DrizzleTagRepository } from "../../db/DrizzleTagRepository";
import {
  extractMovementFormData,
  movementFormSchema,
  movementIntentSchema,
  parseAmountToCents,
  relocateHiddenFieldErrors,
  toMovementFormValues,
  type MovementFieldErrors,
  type MovementFormValues,
  type MovementIntent,
} from "./movement-form.schema";

export type {
  MovementFieldErrors as CreateMovementFieldErrors,
  MovementFieldKey as CreateMovementFieldKey,
  MovementFormValues as CreateMovementFormValues,
} from "./movement-form.schema";

export type CreateMovementState =
  | { status: "idle" }
  | { status: "success"; message: string; intent: MovementIntent }
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
    return { tagId: ["Una de las etiquetas seleccionadas ya no está disponible."] };
  }
  if (error instanceof ContributionAlreadyExistsError) {
    return { _form: [error.message] };
  }
  if (error instanceof CommonContributionNotFoundError || error instanceof SharedAccountContributionError) {
    return { _form: [error.message] };
  }
  if (
    error instanceof SavingsAlreadyExistsError ||
    error instanceof SavingsAllocationNotFoundError ||
    error instanceof SharedAccountSavingsError
  ) {
    return { _form: [error.message] };
  }
  return { _form: ["No se ha podido guardar el movimiento. Inténtalo de nuevo."] };
}

const createMovementUseCase = new CreateMovement(
  new DrizzleMovementRepository(db),
  new DrizzleAccountRepository(db),
  new DrizzleTagRepository(db),
);

const registerManualContributionUseCase = new RegisterManualContribution(
  new DrizzleCommonContributionRepository(db),
  new DrizzleAccountRepository(db),
  new DrizzleTagRepository(db),
);

const registerManualSavingsUseCase = new RegisterManualSavings(
  new DrizzleSavingsAllocationRepository(db),
  new DrizzleAccountRepository(db),
  new DrizzleTagRepository(db),
);

export async function createMovement(
  _prevState: CreateMovementState,
  formData: FormData,
): Promise<CreateMovementState> {
  const raw = extractMovementFormData(formData);
  const parsed = movementFormSchema.safeParse(raw);
  const intent = movementIntentSchema.parse(raw.intent);

  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors as MovementFieldErrors;
    return {
      status: "error",
      errors: relocateHiddenFieldErrors(fieldErrors, raw.type),
      values: toMovementFormValues(raw),
    };
  }

  const data = parsed.data;
  if (data.accountId === undefined) {
    return {
      status: "error",
      errors: { accountId: ["Selecciona una cuenta."] },
      values: toMovementFormValues(raw),
    };
  }

  try {
    if (data.type === "contribution") {
      await registerManualContributionUseCase.execute({
        accountId: data.accountId,
        date: data.date,
        note: data.note,
        amountCents: parseAmountToCents(data.amount.trim()),
      });

      revalidatePath("/", "layout");
      return { status: "success", message: "Aportación registrada", intent };
    }

    if (data.type === "savings") {
      await registerManualSavingsUseCase.execute({
        accountId: data.accountId,
        date: data.date,
        note: data.note,
        amountCents: parseAmountToCents(data.amount.trim()),
      });

      revalidatePath("/", "layout");
      return { status: "success", message: "Ahorro registrado", intent };
    }

    await createMovementUseCase.execute({
      accountId: data.accountId,
      type: data.type,
      date: data.date,
      note: data.note,
      amountCents: parseAmountToCents(data.amount.trim()),
      nature: data.nature ?? null,
      tagId: data.tagId,
    });

    revalidatePath("/");
    revalidatePath("/accounts/[accountId]", "page");
    return { status: "success", message: "Movimiento guardado", intent };
  } catch (error) {
    return {
      status: "error",
      errors: relocateHiddenFieldErrors(mapDomainErrors(error), raw.type),
      values: toMovementFormValues(raw),
    };
  }
}
