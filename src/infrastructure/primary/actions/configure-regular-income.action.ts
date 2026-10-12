"use server";

import { ConfigureRegularIncome } from "@/application/regular-income/ConfigureRegularIncome";
import { DeactivateRegularIncome } from "@/application/regular-income/DeactivateRegularIncome";
import { AccountId } from "@/domain/account/AccountId";
import { InvalidMoneyError } from "@/domain/movement/MovementErrors";
import {
  InvalidRegularIncomeError,
  RegularIncomeNotFoundError,
  SharedAccountIncomeError,
} from "@/domain/regular-income/RegularIncomeErrors";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "../../db/client";
import { DrizzleAccountRepository } from "../../db/DrizzleAccountRepository";
import { DrizzleRegularIncomeRepository } from "../../db/DrizzleRegularIncomeRepository";
import { currentMonth } from "../ui/format";
import { parseAmountToCents } from "./movement-form.schema";

export type RegularIncomeFieldKey = "amount" | "dayOfMonth" | "note" | "accountId" | "_form";

export type RegularIncomeFieldErrors = Partial<Record<RegularIncomeFieldKey, string[]>>;

export interface RegularIncomeFormValues {
  amount: string;
  dayOfMonth: string;
  note: string;
}

export type RegularIncomeIntent = "save" | "deactivate";

export type ConfigureRegularIncomeState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; errors: RegularIncomeFieldErrors; values: RegularIncomeFormValues };

const AMOUNT_PATTERN = /^\d{1,9}([.,]\d{1,2})?$/;
const DAY_OF_MONTH_MESSAGE = "El día del mes debe estar entre 1 y 31.";

const accountIdSchema = z
  .string()
  .regex(/^\d+$/, "No se ha podido guardar el ingreso regular. Inténtalo de nuevo.")
  .transform(Number);

const amountSchema = z.string().superRefine((value, ctx) => {
  const trimmed = value.trim();
  if (trimmed === "") {
    ctx.addIssue({ code: "custom", message: "El importe es obligatorio." });
    return;
  }
  if (!AMOUNT_PATTERN.test(trimmed)) {
    ctx.addIssue({ code: "custom", message: "Introduce un importe válido (ej. 2000,00)." });
    return;
  }
  if (parseAmountToCents(trimmed) <= 0) {
    ctx.addIssue({ code: "custom", message: "El importe debe ser mayor que cero." });
  }
});

const dayOfMonthSchema = z.string().superRefine((value, ctx) => {
  const trimmed = value.trim();
  if (trimmed === "") return;
  if (!/^\d+$/.test(trimmed)) {
    ctx.addIssue({ code: "custom", message: DAY_OF_MONTH_MESSAGE });
    return;
  }
  const day = Number(trimmed);
  if (day < 1 || day > 31) {
    ctx.addIssue({ code: "custom", message: DAY_OF_MONTH_MESSAGE });
  }
});

const regularIncomeFormSchema = z.object({
  amount: amountSchema,
  dayOfMonth: dayOfMonthSchema,
  note: z.string(),
});

function extractFormData(formData: FormData): {
  accountId: string;
  amount: string;
  dayOfMonth: string;
  note: string;
  intent: RegularIncomeIntent;
} {
  return {
    accountId: String(formData.get("accountId") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    dayOfMonth: String(formData.get("dayOfMonth") ?? ""),
    note: String(formData.get("note") ?? ""),
    intent: formData.get("intent") === "deactivate" ? "deactivate" : "save",
  };
}

function toFormValues(raw: ReturnType<typeof extractFormData>): RegularIncomeFormValues {
  return { amount: raw.amount, dayOfMonth: raw.dayOfMonth, note: raw.note };
}

function mapDomainErrors(error: unknown): RegularIncomeFieldErrors {
  if (error instanceof InvalidRegularIncomeError) {
    return { [error.field]: [error.message] };
  }
  if (error instanceof InvalidMoneyError) {
    return { amount: [error.message] };
  }
  if (
    error instanceof SharedAccountIncomeError ||
    error instanceof RegularIncomeNotFoundError
  ) {
    return { _form: [error.message] };
  }
  return { _form: ["No se ha podido guardar el ingreso regular. Inténtalo de nuevo."] };
}

const configureRegularIncomeUseCase = new ConfigureRegularIncome(
  new DrizzleRegularIncomeRepository(db),
  new DrizzleAccountRepository(db),
);

const deactivateRegularIncomeUseCase = new DeactivateRegularIncome(
  new DrizzleRegularIncomeRepository(db),
);

export async function configureRegularIncome(
  _prevState: ConfigureRegularIncomeState,
  formData: FormData,
): Promise<ConfigureRegularIncomeState> {
  const raw = extractFormData(formData);

  const parsedAccountId = accountIdSchema.safeParse(raw.accountId);
  if (!parsedAccountId.success) {
    return {
      status: "error",
      errors: { _form: ["No se ha podido guardar el ingreso regular. Inténtalo de nuevo."] },
      values: toFormValues(raw),
    };
  }
  const accountId = parsedAccountId.data;

  try {
    if (raw.intent === "deactivate") {
      await deactivateRegularIncomeUseCase.execute(AccountId(accountId));
      revalidatePath("/", "layout");
      return { status: "success", message: "Ingreso regular desactivado" };
    }

    const parsed = regularIncomeFormSchema.safeParse({
      amount: raw.amount,
      dayOfMonth: raw.dayOfMonth,
      note: raw.note,
    });
    if (!parsed.success) {
      const fieldErrors = z.flattenError(parsed.error).fieldErrors as RegularIncomeFieldErrors;
      return { status: "error", errors: fieldErrors, values: toFormValues(raw) };
    }

    await configureRegularIncomeUseCase.execute({
      accountId,
      amountCents: parseAmountToCents(parsed.data.amount.trim()),
      dayOfMonth: parsed.data.dayOfMonth.trim() === "" ? 1 : Number(parsed.data.dayOfMonth.trim()),
      note: parsed.data.note.trim() === "" ? null : parsed.data.note,
      currentMonth: currentMonth(),
    });

    revalidatePath("/", "layout");
    return { status: "success", message: "Ingreso regular guardado" };
  } catch (error) {
    return { status: "error", errors: mapDomainErrors(error), values: toFormValues(raw) };
  }
}
