import { isDefaultCategorySlug } from "../tag-category/DefaultCategory";
import { isProtectedTagSlug } from "../tag/SystemTags";
import type { ExpenseNature } from "./ExpenseNature";
import type { MovementType } from "./MovementType";

export interface AnnualExpenseInput {
  month: string;
  type: MovementType;
  nature: ExpenseNature | null;
  amountCents: number;
  tagSlug: string | null;
  tagCategoryId: number | null;
  accountKind: "personal" | "common";
}

export interface CategoryExpenseRef {
  id: number;
  name: string;
  slug: string;
}

export interface CategoryExpenseRow {
  categoryId: number;
  categoryName: string;
  isDefaultCategory: boolean;
  monthlyAmountCents: readonly number[];
  annualTotalCents: number;
  annualAverageCents: number;
}

const MONTHS_IN_YEAR = 12;

function zeroCells(): number[] {
  return Array<number>(MONTHS_IN_YEAR).fill(0);
}

function sumCents(cells: readonly number[]): number {
  return cells.reduce((sum, cents) => sum + cents, 0);
}

function averageCentsOf(totalCents: number): number {
  return Math.round(totalCents / MONTHS_IN_YEAR);
}

function monthIndexOf(month: string): number {
  return Number(month.slice(5, 7)) - 1;
}

function compareCategories(a: CategoryExpenseRef, b: CategoryExpenseRef): number {
  const aDefault = isDefaultCategorySlug(a.slug);
  const bDefault = isDefaultCategorySlug(b.slug);
  if (aDefault !== bDefault) return aDefault ? -1 : 1;
  return a.name.localeCompare(b.name, "es");
}

export class AnnualCategoryExpenseReport {
  readonly year: string;
  readonly rows: readonly CategoryExpenseRow[];
  readonly monthlyTotalCents: readonly number[];
  readonly monthlyPersonalTotalCents: readonly number[];
  readonly monthlyTotalAverageCents: number;
  readonly personalTotalAverageCents: number;

  private constructor(
    year: string,
    rows: CategoryExpenseRow[],
    monthlyTotalCents: number[],
    monthlyPersonalTotalCents: number[],
  ) {
    this.year = year;
    this.rows = Object.freeze([...rows]);
    this.monthlyTotalCents = Object.freeze([...monthlyTotalCents]);
    this.monthlyPersonalTotalCents = Object.freeze([...monthlyPersonalTotalCents]);
    this.monthlyTotalAverageCents = averageCentsOf(sumCents(monthlyTotalCents));
    this.personalTotalAverageCents = averageCentsOf(sumCents(monthlyPersonalTotalCents));
    Object.freeze(this);
  }

  static fromMovements(
    year: string,
    inputs: readonly AnnualExpenseInput[],
    categories: readonly CategoryExpenseRef[],
  ): AnnualCategoryExpenseReport {
    const sortedCategories = [...categories].sort(compareCategories);
    const cellsByCategory = new Map<number, number[]>();
    for (const category of sortedCategories) {
      cellsByCategory.set(category.id, zeroCells());
    }

    const monthlyTotalCents = zeroCells();
    const monthlyPersonalTotalCents = zeroCells();

    for (const input of inputs) {
      if (input.type !== "expense") continue;
      if (input.tagSlug === null || input.tagCategoryId === null) continue;
      if (isProtectedTagSlug(input.tagSlug)) continue;

      const monthIndex = monthIndexOf(input.month);
      if (monthIndex < 0 || monthIndex >= MONTHS_IN_YEAR) continue;

      monthlyTotalCents[monthIndex] += input.amountCents;
      if (input.nature === "personal" && input.accountKind === "personal") {
        monthlyPersonalTotalCents[monthIndex] += input.amountCents;
      }

      const cells = cellsByCategory.get(input.tagCategoryId);
      if (cells !== undefined) {
        cells[monthIndex] += input.amountCents;
      }
    }

    const rows = sortedCategories.map((category) => {
      const cells = cellsByCategory.get(category.id) ?? zeroCells();
      const annualTotalCents = sumCents(cells);
      return Object.freeze({
        categoryId: category.id,
        categoryName: category.name,
        isDefaultCategory: isDefaultCategorySlug(category.slug),
        monthlyAmountCents: Object.freeze([...cells]),
        annualTotalCents,
        annualAverageCents: averageCentsOf(annualTotalCents),
      });
    });

    return new AnnualCategoryExpenseReport(
      year,
      rows,
      monthlyTotalCents,
      monthlyPersonalTotalCents,
    );
  }
}
