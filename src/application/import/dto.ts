import type { ExpenseNature } from "@/domain/movement/ExpenseNature";
import type { MovementType } from "@/domain/movement/MovementType";

export interface SheetPreviewRowDTO {
  line: number;
  status: "ok" | "ignored" | "error";
  reason?: string;
  movement?: {
    date: string;
    note: string;
    amountCents: number;
    type: MovementType;
    nature: ExpenseNature | null;
    tagName: string | null;
    createsTag: boolean;
  };
}

export interface SheetImportTotalsDTO {
  movements: number;
  personalExpenseCents: number;
  sharedExpenseCents: number;
  incomeCents: number;
  ignored: number;
  errors: number;
}

export interface SheetImportPreviewDTO {
  accountName: string;
  month: string;
  rows: SheetPreviewRowDTO[];
  totals: SheetImportTotalsDTO;
  tagsToCreate: string[];
}
