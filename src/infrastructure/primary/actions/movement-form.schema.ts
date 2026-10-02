import { ExpenseNature } from "@/domain/movement/ExpenseNature";
import { MovementType } from "@/domain/movement/MovementType";
import { z } from "zod";

export type MovementFieldKey =
  | "date"
  | "note"
  | "amount"
  | "accountId"
  | "type"
  | "nature"
  | "tagId"
  | "_form";

export type MovementFieldErrors = Partial<Record<MovementFieldKey, string[]>>;

export interface MovementFormValues {
  date: string;
  note: string;
  amount: string;
  accountId: string;
  type: string;
  nature: string;
  tagId: string;
}

export interface RawMovementInput {
  date: string;
  note: string;
  amount: string;
  accountId: string;
  type: string;
  nature?: string;
  tagId: string;
  intent?: string;
}

const AMOUNT_PATTERN = /^\d{1,9}([.,]\d{1,2})?$/;

function isRealCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function parseAmountToCents(value: string): number {
  const normalized = value.replace(",", ".");
  const separatorIndex = normalized.indexOf(".");
  if (separatorIndex === -1) {
    return Number(normalized) * 100;
  }
  const integerPart = normalized.slice(0, separatorIndex);
  const decimalPart = normalized.slice(separatorIndex + 1).padEnd(2, "0");
  return Number(integerPart) * 100 + Number(decimalPart);
}

export const movementFormSchema = z
  .object({
    date: z.string().refine(isRealCalendarDate, "Indica una fecha válida."),
    note: z
      .string()
      .trim()
      .min(1, "La nota es obligatoria."),
    amount: z.string().superRefine((value, ctx) => {
      const trimmed = value.trim();
      if (trimmed === "") {
        ctx.addIssue({ code: "custom", message: "El importe es obligatorio." });
        return;
      }
      if (!AMOUNT_PATTERN.test(trimmed)) {
        ctx.addIssue({ code: "custom", message: "Introduce un importe válido (ej. 850,00)." });
        return;
      }
      if (parseAmountToCents(trimmed) <= 0) {
        ctx.addIssue({
          code: "custom",
          message: "El importe debe ser mayor que cero. Los abonos se registran como ingresos.",
        });
      }
    }),
    accountId: z
      .string()
      .regex(/^\d+$/, "Selecciona una cuenta.")
      .transform(Number)
      .or(z.literal("").transform(() => undefined))
      .optional(),
    type: z
      .string()
      .refine(
        (value): value is MovementType => value === "expense" || value === "income",
        "Selecciona el tipo de movimiento.",
      ),
    nature: z
      .string()
      .refine(
        (value): value is ExpenseNature => value === "personal" || value === "shared",
        "Selecciona la naturaleza del gasto (personal o compartido).",
      )
      .optional(),
    tagId: z
      .string()
      .regex(/^\d+$/, "Una de las etiquetas seleccionadas ya no está disponible.")
      .transform(Number)
      .or(z.literal("").transform(() => null)),
  })
  .superRefine((data, ctx) => {
    if (data.type === "expense" && data.nature === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["nature"],
        message: "Selecciona la naturaleza del gasto (personal o compartido).",
      });
    }
    if (data.type === "income" && data.nature !== undefined) {
      ctx.addIssue({ code: "custom", path: ["nature"], message: "Los ingresos no llevan naturaleza." });
    }
    if (data.type === "expense" && data.tagId === null) {
      ctx.addIssue({
        code: "custom",
        path: ["tagId"],
        message: "Selecciona una etiqueta para el gasto.",
      });
    }
  });

export const movementIntentSchema = z
  .string()
  .optional()
  .transform((value) => (value === "continue" ? "continue" : "close"));

export type MovementIntent = "continue" | "close";

export function extractMovementFormData(formData: FormData): RawMovementInput {
  const nature = formData.get("nature");
  const intent = formData.get("intent");
  return {
    date: String(formData.get("date") ?? ""),
    note: String(formData.get("note") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    accountId: String(formData.get("accountId") ?? ""),
    type: String(formData.get("type") ?? ""),
    nature: nature === null ? undefined : String(nature),
    tagId: String(formData.get("tagId") ?? ""),
    intent: intent === null ? undefined : String(intent),
  };
}

export function toMovementFormValues(raw: RawMovementInput): MovementFormValues {
  return {
    date: raw.date,
    note: raw.note,
    amount: raw.amount,
    accountId: raw.accountId,
    type: raw.type,
    nature: raw.nature ?? "",
    tagId: raw.tagId,
  };
}
