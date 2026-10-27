"use server";

import { ConfigureSavingsAllocation } from "@/application/savings/ConfigureSavingsAllocation";
import { DeactivateSavingsAllocation } from "@/application/savings/DeactivateSavingsAllocation";
import { AccountId } from "@/domain/account/AccountId";
import {
  InvalidSavingsAllocationError,
  MissingRegularIncomeError,
  SavingsAllocationNotFoundError,
  SharedAccountSavingsError,
} from "@/domain/savings/SavingsAllocationErrors";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "../../db/client";
import { DrizzleAccountRepository } from "../../db/DrizzleAccountRepository";
import { DrizzleRegularIncomeRepository } from "../../db/DrizzleRegularIncomeRepository";
import { DrizzleSavingsAllocationRepository } from "../../db/DrizzleSavingsAllocationRepository";
import { currentMonth } from "../ui/format";
import { INTEGER_PERCENTAGE_PATTERN, parseIntegerPercentage } from "./savings-form.schema";

export type SavingsAllocationFieldKey = "percentage" | "accountId" | "_form";

export type SavingsAllocationFieldErrors = Partial<Record<SavingsAllocationFieldKey, string[]>>;

export interface SavingsAllocationFormValues {
  percentage: string;
}

export type SavingsAllocationIntent = "save" | "deactivate";

export type ConfigureSavingsAllocationState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; errors: SavingsAllocationFieldErrors; values: SavingsAllocationFormValues };

const accountIdSchema = z
  .string()
  .regex(/^\d+$/, "No se ha podido guardar el ahorro. Inténtalo de nuevo.")
  .transform(Number);

const percentageSchema = z.string().superRefine((value, ctx) => {
  const trimmed = value.trim();
  if (trimmed === "") {
    ctx.addIssue({ code: "custom", message: "El porcentaje es obligatorio." });
    return;
  }
  if (!INTEGER_PERCENTAGE_PATTERN.test(trimmed)) {
    ctx.addIssue({ code: "custom", message: "Introduce un porcentaje entero entre 1 y 100 (ej. 10)." });
    return;
  }
  if (parseIntegerPercentage(trimmed) <= 0) {
    ctx.addIssue({ code: "custom", message: "El porcentaje debe ser mayor que cero." });
    return;
  }
  if (parseIntegerPercentage(trimmed) > 100) {
    ctx.addIssue({ code: "custom", message: "El porcentaje no puede ser mayor que 100." });
  }
});

const savingsFormSchema = z.object({
  percentage: percentageSchema,
});

function extractFormData(formData: FormData): {
  accountId: string;
  percentage: string;
  intent: SavingsAllocationIntent;
} {
  return {
    accountId: String(formData.get("accountId") ?? ""),
    percentage: String(formData.get("percentage") ?? ""),
    intent: formData.get("intent") === "deactivate" ? "deactivate" : "save",
  };
}

function mapDomainErrors(error: unknown): SavingsAllocationFieldErrors {
  if (error instanceof InvalidSavingsAllocationError) {
    return { [error.field]: [error.message] };
  }
  if (
    error instanceof SharedAccountSavingsError ||
    error instanceof SavingsAllocationNotFoundError ||
    error instanceof MissingRegularIncomeError
  ) {
    return { _form: [error.message] };
  }
  return { _form: ["No se ha podido guardar el ahorro. Inténtalo de nuevo."] };
}

const configureSavingsAllocationUseCase = new ConfigureSavingsAllocation(
  new DrizzleSavingsAllocationRepository(db),
  new DrizzleRegularIncomeRepository(db),
  new DrizzleAccountRepository(db),
);

const deactivateSavingsAllocationUseCase = new DeactivateSavingsAllocation(
  new DrizzleSavingsAllocationRepository(db),
);

export async function configureSavingsAllocation(
  _prevState: ConfigureSavingsAllocationState,
  formData: FormData,
): Promise<ConfigureSavingsAllocationState> {
  const raw = extractFormData(formData);

  const parsedAccountId = accountIdSchema.safeParse(raw.accountId);
  if (!parsedAccountId.success) {
    return {
      status: "error",
      errors: { _form: ["No se ha podido guardar el ahorro. Inténtalo de nuevo."] },
      values: { percentage: raw.percentage },
    };
  }
  const accountId = parsedAccountId.data;

  try {
    if (raw.intent === "deactivate") {
      await deactivateSavingsAllocationUseCase.execute(AccountId(accountId));
      revalidatePath("/", "layout");
      return { status: "success", message: "Ahorro desactivado" };
    }

    const parsed = savingsFormSchema.safeParse({ percentage: raw.percentage });
    if (!parsed.success) {
      const fieldErrors = z.flattenError(parsed.error).fieldErrors as SavingsAllocationFieldErrors;
      return { status: "error", errors: fieldErrors, values: { percentage: raw.percentage } };
    }

    await configureSavingsAllocationUseCase.execute({
      accountId,
      percentage: parseIntegerPercentage(parsed.data.percentage.trim()),
      currentMonth: currentMonth(),
    });

    revalidatePath("/", "layout");
    return { status: "success", message: "Ahorro guardado" };
  } catch (error) {
    return {
      status: "error",
      errors: mapDomainErrors(error),
      values: { percentage: raw.percentage },
    };
  }
}
