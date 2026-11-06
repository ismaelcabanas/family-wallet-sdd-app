import { AccountId } from "@/domain/account/AccountId";
import type { ExpenseNature } from "@/domain/movement/ExpenseNature";
import { Movement } from "@/domain/movement/Movement";
import { Money } from "@/domain/movement/Money";
import type { MovementType } from "@/domain/movement/MovementType";
import { DomainError } from "@/domain/shared/DomainError";
import { TagId } from "@/domain/tag/TagId";

export interface SheetCellsRow {
  line: number;
  cells: string[];
}

export interface PlanCatalogTag {
  id: number;
  name: string;
  slug: string;
}

export interface PlanInput {
  month: string;
  rows: SheetCellsRow[];
  activeTags: PlanCatalogTag[];
  inactiveTagNames: string[];
  defaultCategoryId: number;
}

export interface PlannedMovement {
  date: string;
  note: string;
  amountCents: number;
  type: MovementType;
  nature: ExpenseNature | null;
  tagName: string | null;
  tagId: number | null;
  createsTag: boolean;
}

export type PlanRow =
  | { line: number; status: "ok"; movement: PlannedMovement }
  | { line: number; status: "ignored"; reason: string }
  | { line: number; status: "error"; reason: string };

export interface ImportPlanTotals {
  movements: number;
  personalExpenseCents: number;
  sharedExpenseCents: number;
  incomeCents: number;
  ignored: number;
  errors: number;
}

export interface ImportPlan {
  rows: PlanRow[];
  totals: ImportPlanTotals;
  tagsToCreate: { name: string; categoryId: number }[];
  hasErrors: boolean;
}

const COLUMN_COUNT = 13;
const DATE = 0;
const CONCEPT = 1;
const DESCRIPTION = 2;
const TYPE = 3;
const AMOUNT = 4;
const CATEGORY = 5;

const IGNORED_REASON = "fila de configuración de la hoja";
const EXCLUDED_CONCEPT = "Aportación Común";
const EXCLUDED_TYPE = "Ahorro";

const TYPE_MAPPING: Record<string, { type: MovementType; nature: ExpenseNature | null }> = {
  Gasto: { type: "expense", nature: "personal" },
  "Gasto Común": { type: "expense", nature: "shared" },
  "Gasto Fijo": { type: "expense", nature: "personal" },
  Ingreso: { type: "income", nature: null },
};

const SHEET_AMOUNT_PATTERN = /^\d{1,9}(\.\d{1,2})?$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const VALIDATION_ONLY_ACCOUNT_ID = AccountId(1);
const PENDING_TAG_ID = -1 as TagId;

function parseSheetAmountToCents(raw: string): number | null {
  if (!SHEET_AMOUNT_PATTERN.test(raw)) return null;
  const [integerPart, decimalPart] = raw.split(".");
  if (decimalPart === undefined) {
    return Number(`${integerPart}00`);
  }
  return Number(`${integerPart}${decimalPart.padEnd(2, "0")}`);
}

function isRowEmpty(cells: string[]): boolean {
  return cells.every((cell) => cell.trim() === "");
}

export function buildSheetImportPlan(input: PlanInput): ImportPlan {
  const rows: PlanRow[] = [];
  const tagsToCreate: { name: string; categoryId: number }[] = [];
  const totals: ImportPlanTotals = {
    movements: 0,
    personalExpenseCents: 0,
    sharedExpenseCents: 0,
    incomeCents: 0,
    ignored: 0,
    errors: 0,
  };

  for (const row of input.rows) {
    const planned = planRow(row, input, tagsToCreate);
    rows.push(planned);

    if (planned.status === "ignored") {
      totals.ignored += 1;
      continue;
    }
    if (planned.status === "error") {
      totals.errors += 1;
      continue;
    }

    totals.movements += 1;
    const movement = planned.movement;
    if (movement.type === "expense") {
      if (movement.nature === "personal") {
        totals.personalExpenseCents += movement.amountCents;
      } else {
        totals.sharedExpenseCents += movement.amountCents;
      }
    } else {
      totals.incomeCents += movement.amountCents;
    }
  }

  return { rows, totals, tagsToCreate, hasErrors: totals.errors > 0 };
}

function planRow(
  row: SheetCellsRow,
  input: PlanInput,
  tagsToCreate: { name: string; categoryId: number }[],
): PlanRow {
  if (row.cells.length !== COLUMN_COUNT) {
    return {
      line: row.line,
      status: "error",
      reason: "La fila no tiene las 13 columnas de la hoja mensual.",
    };
  }

  const concept = row.cells[CONCEPT].trim();
  const description = row.cells[DESCRIPTION].trim();
  const type = row.cells[TYPE].trim();

  if (isRowEmpty(row.cells) || concept === EXCLUDED_CONCEPT || type === EXCLUDED_TYPE) {
    return { line: row.line, status: "ignored", reason: IGNORED_REASON };
  }

  const mapped = TYPE_MAPPING[type];
  if (mapped === undefined) {
    return {
      line: row.line,
      status: "error",
      reason: `El tipo de transacción "${type}" no se reconoce.`,
    };
  }

  const rawDate = row.cells[DATE].trim();
  let date = `${input.month}-01`;
  if (rawDate !== "") {
    if (!ISO_DATE_PATTERN.test(rawDate) || rawDate.slice(0, 7) !== input.month) {
      return {
        line: row.line,
        status: "error",
        reason: `La fecha "${rawDate}" no pertenece al mes seleccionado.`,
      };
    }
    date = rawDate;
  }

  const rawAmount = row.cells[AMOUNT].trim();
  const amountCents = parseSheetAmountToCents(rawAmount);
  if (amountCents === null) {
    return {
      line: row.line,
      status: "error",
      reason: `El importe "${rawAmount}" no tiene un formato válido (usa punto decimal y hasta dos decimales).`,
    };
  }

  const note =
    description === ""
      ? concept
      : concept === ""
        ? description
        : `${concept} — ${description}`;

  const categoryName = row.cells[CATEGORY].trim();
  let tagId: number | null = null;
  let tagName: string | null = null;
  let createsTag = false;

  if (categoryName !== "") {
    const active = input.activeTags.find(
      (tag) => tag.name.toLowerCase() === categoryName.toLowerCase(),
    );
    if (active !== undefined) {
      tagId = active.id;
      tagName = active.name;
    } else if (
      input.inactiveTagNames.some(
        (name) => name.toLowerCase() === categoryName.toLowerCase(),
      )
    ) {
      return {
        line: row.line,
        status: "error",
        reason: `La etiqueta "${categoryName}" está desactivada.`,
      };
    } else {
      createsTag = true;
      tagName = categoryName;
      if (!tagsToCreate.some((tag) => tag.name.toLowerCase() === categoryName.toLowerCase())) {
        tagsToCreate.push({ name: categoryName, categoryId: input.defaultCategoryId });
      }
    }
  }

  try {
    Movement.create({
      accountId: VALIDATION_ONLY_ACCOUNT_ID,
      type: mapped.type,
      date,
      note,
      amount: Money.fromCents(amountCents),
      nature: mapped.nature,
      tagId: createsTag ? PENDING_TAG_ID : tagId === null ? null : TagId(tagId),
    });
  } catch (error) {
    if (error instanceof DomainError) {
      return { line: row.line, status: "error", reason: error.message };
    }
    throw error;
  }

  return {
    line: row.line,
    status: "ok",
    movement: {
      date,
      note,
      amountCents,
      type: mapped.type,
      nature: mapped.nature,
      tagName,
      tagId: createsTag ? null : tagId,
      createsTag,
    },
  };
}
