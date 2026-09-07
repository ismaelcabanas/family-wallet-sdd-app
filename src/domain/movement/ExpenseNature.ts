export const EXPENSE_NATURES = ["personal", "shared"] as const;

export type ExpenseNature = (typeof EXPENSE_NATURES)[number];

export function isExpenseNature(value: unknown): value is ExpenseNature {
  return typeof value === "string" && (EXPENSE_NATURES as readonly string[]).includes(value);
}
