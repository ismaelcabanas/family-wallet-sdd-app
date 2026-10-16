"use server";

import { ConfigureCommonContribution } from "@/application/common-contribution/ConfigureCommonContribution";
import { DeactivateCommonContribution } from "@/application/common-contribution/DeactivateCommonContribution";
import { AccountId } from "@/domain/account/AccountId";
import {
  CommonContributionNotFoundError,
  InvalidCommonContributionError,
  MissingRegularIncomeError,
  SharedAccountContributionError,
} from "@/domain/common-contribution/CommonContributionErrors";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "../../db/client";
import { DrizzleAccountRepository } from "../../db/DrizzleAccountRepository";
import { DrizzleCommonContributionRepository } from "../../db/DrizzleCommonContributionRepository";
import { DrizzleRegularIncomeRepository } from "../../db/DrizzleRegularIncomeRepository";
import { currentMonth } from "../ui/format";
import { PERCENTAGE_PATTERN, parsePercentageToBasisPoints } from "./contribution-form.schema";

export type CommonContributionFieldKey = "percentage" | "accountId" | "_form";

export type CommonContributionFieldErrors = Partial<Record<CommonContributionFieldKey, string[]>>;

export interface CommonContributionFormValues {
  percentage: string;
}

export type CommonContributionIntent = "save" | "deactivate";

export type ConfigureCommonContributionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; errors: CommonContributionFieldErrors; values: CommonContributionFormValues };

const accountIdSchema = z
  .string()
  .regex(/^\d+$/, "No se ha podido guardar la aportación. Inténtalo de nuevo.")
  .transform(Number);

const percentageSchema = z.string().superRefine((value, ctx) => {
  const trimmed = value.trim();
  if (trimmed === "") {
    ctx.addIssue({ code: "custom", message: "El porcentaje es obligatorio." });
    return;
  }
  if (!PERCENTAGE_PATTERN.test(trimmed)) {
    ctx.addIssue({ code: "custom", message: "Introduce un porcentaje válido (ej. 25 o 12,5)." });
    return;
  }
  if (parsePercentageToBasisPoints(trimmed) <= 0) {
    ctx.addIssue({ code: "custom", message: "El porcentaje debe ser mayor que cero." });
    return;
  }
  if (parsePercentageToBasisPoints(trimmed) > 10_000) {
    ctx.addIssue({ code: "custom", message: "El porcentaje no puede ser mayor que 100." });
  }
});

const contributionFormSchema = z.object({
  percentage: percentageSchema,
});

function extractFormData(formData: FormData): {
  accountId: string;
  percentage: string;
  intent: CommonContributionIntent;
} {
  return {
    accountId: String(formData.get("accountId") ?? ""),
    percentage: String(formData.get("percentage") ?? ""),
    intent: formData.get("intent") === "deactivate" ? "deactivate" : "save",
  };
}

function mapDomainErrors(error: unknown): CommonContributionFieldErrors {
  if (error instanceof InvalidCommonContributionError) {
    return { [error.field]: [error.message] };
  }
  if (
    error instanceof SharedAccountContributionError ||
    error instanceof CommonContributionNotFoundError ||
    error instanceof MissingRegularIncomeError
  ) {
    return { _form: [error.message] };
  }
  return { _form: ["No se ha podido guardar la aportación. Inténtalo de nuevo."] };
}

const configureCommonContributionUseCase = new ConfigureCommonContribution(
  new DrizzleCommonContributionRepository(db),
  new DrizzleRegularIncomeRepository(db),
  new DrizzleAccountRepository(db),
);

const deactivateCommonContributionUseCase = new DeactivateCommonContribution(
  new DrizzleCommonContributionRepository(db),
);

export async function configureCommonContribution(
  _prevState: ConfigureCommonContributionState,
  formData: FormData,
): Promise<ConfigureCommonContributionState> {
  const raw = extractFormData(formData);

  const parsedAccountId = accountIdSchema.safeParse(raw.accountId);
  if (!parsedAccountId.success) {
    return {
      status: "error",
      errors: { _form: ["No se ha podido guardar la aportación. Inténtalo de nuevo."] },
      values: { percentage: raw.percentage },
    };
  }
  const accountId = parsedAccountId.data;

  try {
    if (raw.intent === "deactivate") {
      await deactivateCommonContributionUseCase.execute(AccountId(accountId));
      revalidatePath("/", "layout");
      return { status: "success", message: "Aportación desactivada" };
    }

    const parsed = contributionFormSchema.safeParse({ percentage: raw.percentage });
    if (!parsed.success) {
      const fieldErrors = z.flattenError(parsed.error).fieldErrors as CommonContributionFieldErrors;
      return { status: "error", errors: fieldErrors, values: { percentage: raw.percentage } };
    }

    await configureCommonContributionUseCase.execute({
      accountId,
      percentageBasisPoints: parsePercentageToBasisPoints(parsed.data.percentage.trim()),
      currentMonth: currentMonth(),
    });

    revalidatePath("/", "layout");
    return { status: "success", message: "Aportación guardada" };
  } catch (error) {
    return {
      status: "error",
      errors: mapDomainErrors(error),
      values: { percentage: raw.percentage },
    };
  }
}
