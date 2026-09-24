import type { ExpenseNature } from "@/domain/movement/ExpenseNature";
import type { MovementType } from "@/domain/movement/MovementType";

export interface CreateMovementDTO {
  accountId: number;
  type: MovementType;
  date: string;
  concept: string;
  description: string | null;
  amountCents: number;
  nature: ExpenseNature | null;
  tagIds: number[];
}

export interface UpdateMovementDTO {
  movementId: number;
  accountId: number;
  type: MovementType;
  date: string;
  concept: string;
  description: string | null;
  amountCents: number;
  nature: ExpenseNature | null;
  tagIds: number[];
}

export interface MovementTagDTO {
  id: number;
  name: string;
  slug: string;
}

export interface MovementDTO {
  id: number;
  accountId: number;
  type: MovementType;
  date: string;
  concept: string;
  description: string | null;
  amountCents: number;
  nature: ExpenseNature | null;
  tags: MovementTagDTO[];
}

export interface AccountDTO {
  id: number;
  name: string;
  type: "personal" | "shared";
  memberId: number | null;
  memberName: string | null;
}

export interface TagDTO {
  id: number;
  name: string;
  slug: string;
}

export interface TagBreakdownEntryDTO {
  tagId: number;
  tagName: string;
  amountCents: number;
}

export interface MonthlyClosureDTO {
  incomeTotalCents: number;
  expenseTotalCents: number;
  sharedExpenseCents: number;
  personalExpenseCents: number;
  monthBalanceCents: number;
  tagBreakdown: TagBreakdownEntryDTO[];
}

export interface MemberBreakdownEntryDTO {
  memberId: number | null;
  memberName: string | null;
  personalCents: number;
  sharedCents: number;
}

export interface GlobalMonthlySummaryDTO {
  incomeTotalCents: number;
  expenseTotalCents: number;
  sharedExpenseCents: number;
  personalExpenseCents: number;
  monthBalanceCents: number;
  tagBreakdown: TagBreakdownEntryDTO[];
  memberBreakdown: MemberBreakdownEntryDTO[];
}

export interface MemberIncomeRowDTO {
  memberId: number | null;
  memberName: string | null;
  monthlyIncomeCents: number[];
  totalCents: number;
  averageCents: number;
}

export interface MonthlyTotalsRowDTO {
  monthlyCents: number[];
  totalCents: number;
  averageCents: number;
}

export interface AccumulatedBalanceRowDTO {
  monthlyCents: number[];
  totalCents: number;
}

export interface AnnualTagRowDTO {
  tagId: number;
  tagName: string;
  monthlyCents: number[];
  totalCents: number;
  averageCents: number;
}

export interface AnnualIncomeStatementDTO {
  monthlySummaries: GlobalMonthlySummaryDTO[];
  memberIncomeRows: MemberIncomeRowDTO[];
  totalIncomeRow: MonthlyTotalsRowDTO;
  expenseRealRow: MonthlyTotalsRowDTO;
  noPersonalExpenseRow: MonthlyTotalsRowDTO;
  balanceRow: MonthlyTotalsRowDTO;
  accumulatedBalanceRow: AccumulatedBalanceRowDTO;
  tagRows: AnnualTagRowDTO[];
}
