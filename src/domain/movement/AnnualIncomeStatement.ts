import { Money } from "./Money";
import {
  GlobalMonthlySummary,
  type GlobalSummaryMovementInput,
  type SummaryAccountRef,
} from "./GlobalMonthlySummary";

export interface AnnualStatementMovementInput extends GlobalSummaryMovementInput {
  date: string;
}

export interface MemberRef {
  id: number;
  name: string;
}

export interface MemberIncomeRow {
  memberId: number | null;
  memberName: string | null;
  monthCells: Money[];
  totalCents: number;
  averageCents: number;
}

export interface MonthlyTotalsRow {
  monthCells: Money[];
  totalCents: number;
  averageCents: number;
}

export interface AnnualTagRow {
  tagId: number;
  tagName: string;
  monthCells: Money[];
  totalCents: number;
  averageCents: number;
}

interface MemberIncomeAccumulator {
  memberId: number | null;
  memberName: string | null;
  cells: number[];
}

interface TagAccumulator {
  tagId: number;
  tagName: string;
  cells: number[];
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

function monthIndexOf(date: string): number {
  return Number(date.slice(5, 7)) - 1;
}

function compareTagRows(a: TagAccumulator, b: TagAccumulator): number {
  const totalDiff = sumCents(b.cells) - sumCents(a.cells);
  if (totalDiff !== 0) return totalDiff;
  return a.tagName.localeCompare(b.tagName, "es");
}

export class AnnualIncomeStatement {
  readonly monthlySummaries: readonly GlobalMonthlySummary[];
  readonly memberIncomeRows: readonly MemberIncomeRow[];
  readonly totalIncomeRow: MonthlyTotalsRow;
  readonly expenseRealRow: MonthlyTotalsRow;
  readonly noPersonalExpenseRow: MonthlyTotalsRow;
  readonly balanceRow: MonthlyTotalsRow;
  readonly accumulatedBalanceRow: MonthlyTotalsRow;
  readonly tagRows: readonly AnnualTagRow[];

  private constructor(
    monthlySummaries: GlobalMonthlySummary[],
    memberIncomeRows: MemberIncomeRow[],
    totalIncomeRow: MonthlyTotalsRow,
    expenseRealRow: MonthlyTotalsRow,
    noPersonalExpenseRow: MonthlyTotalsRow,
    balanceRow: MonthlyTotalsRow,
    accumulatedBalanceRow: MonthlyTotalsRow,
    tagRows: AnnualTagRow[],
  ) {
    this.monthlySummaries = Object.freeze([...monthlySummaries]);
    this.memberIncomeRows = Object.freeze([...memberIncomeRows]);
    this.totalIncomeRow = Object.freeze(totalIncomeRow);
    this.expenseRealRow = Object.freeze(expenseRealRow);
    this.noPersonalExpenseRow = Object.freeze(noPersonalExpenseRow);
    this.balanceRow = Object.freeze(balanceRow);
    this.accumulatedBalanceRow = Object.freeze(accumulatedBalanceRow);
    this.tagRows = Object.freeze([...tagRows]);
    Object.freeze(this);
  }

  static fromMovements(
    inputs: readonly AnnualStatementMovementInput[],
    accounts: readonly SummaryAccountRef[],
    members: readonly MemberRef[],
  ): AnnualIncomeStatement {
    const monthlySummaries = AnnualIncomeStatement.buildMonthlySummaries(inputs, accounts);
    const memberIncomeRows = AnnualIncomeStatement.buildMemberIncomeRows(inputs, accounts, members);
    const tagRows = AnnualIncomeStatement.buildTagRows(monthlySummaries);

    const totalIncomeRow = AnnualIncomeStatement.rowFromMonthlyKpi(
      monthlySummaries,
      (summary) => summary.incomeTotal.amountCents,
    );
    const expenseRealRow = AnnualIncomeStatement.rowFromMonthlyKpi(
      monthlySummaries,
      (summary) => summary.expenseTotal.amountCents,
    );
    const noPersonalExpenseRow = AnnualIncomeStatement.rowFromMonthlyKpi(
      monthlySummaries,
      (summary) => summary.sharedExpenseTotal.amountCents,
    );
    const balanceRow = AnnualIncomeStatement.rowFromMonthlyKpi(
      monthlySummaries,
      (summary) => summary.monthBalance.amountCents,
    );
    const accumulatedBalanceRow =
      AnnualIncomeStatement.buildAccumulatedBalanceRow(balanceRow);

    return new AnnualIncomeStatement(
      monthlySummaries,
      memberIncomeRows,
      totalIncomeRow,
      expenseRealRow,
      noPersonalExpenseRow,
      balanceRow,
      accumulatedBalanceRow,
      tagRows,
    );
  }

  private static buildMonthlySummaries(
    inputs: readonly AnnualStatementMovementInput[],
    accounts: readonly SummaryAccountRef[],
  ): GlobalMonthlySummary[] {
    const inputsByMonth: GlobalSummaryMovementInput[][] = Array.from(
      { length: MONTHS_IN_YEAR },
      () => [],
    );

    for (const input of inputs) {
      inputsByMonth[monthIndexOf(input.date)].push(input);
    }

    return inputsByMonth.map((monthInputs) =>
      GlobalMonthlySummary.fromMovements(monthInputs, accounts),
    );
  }

  private static buildMemberIncomeRows(
    inputs: readonly AnnualStatementMovementInput[],
    accounts: readonly SummaryAccountRef[],
    members: readonly MemberRef[],
  ): MemberIncomeRow[] {
    const accountsById = new Map<number, SummaryAccountRef>();
    for (const account of accounts) {
      accountsById.set(account.id, account);
    }

    const rowsByMemberKey = new Map<string, MemberIncomeAccumulator>();
    for (const member of members) {
      rowsByMemberKey.set(`member-${member.id}`, {
        memberId: member.id,
        memberName: member.name,
        cells: zeroCells(),
      });
    }

    for (const input of inputs) {
      if (input.type !== "income") continue;

      const account = accountsById.get(input.accountId);
      const isPersonal = account?.type === "personal" && account.memberId !== null;
      const key = isPersonal ? `member-${account?.memberId}` : "common";

      const row = rowsByMemberKey.get(key) ?? {
        memberId: isPersonal ? (account?.memberId as number) : null,
        memberName: null,
        cells: zeroCells(),
      };
      row.cells[monthIndexOf(input.date)] += input.amountCents;
      rowsByMemberKey.set(key, row);
    }

    const memberRows = members
      .map((member) => rowsByMemberKey.get(`member-${member.id}`))
      .filter((row): row is MemberIncomeAccumulator => row !== undefined);
    const commonRow = rowsByMemberKey.get("common") ?? {
      memberId: null,
      memberName: null,
      cells: zeroCells(),
    };

    const rows = [...memberRows, commonRow];

    return rows.map((row) => {
      const totalCents = sumCents(row.cells);
      return Object.freeze({
        memberId: row.memberId,
        memberName: row.memberName,
        monthCells: row.cells.map((cents) => Money.fromCentsOrZero(cents)),
        totalCents,
        averageCents: averageCentsOf(totalCents),
      });
    });
  }

  private static rowFromMonthlyKpi(
    monthlySummaries: readonly GlobalMonthlySummary[],
    kpi: (summary: GlobalMonthlySummary) => number,
  ): MonthlyTotalsRow {
    const cells = monthlySummaries.map((summary) => kpi(summary));
    const totalCents = sumCents(cells);
    return Object.freeze({
      monthCells: cells.map((cents) => Money.fromCentsOrZero(cents)),
      totalCents,
      averageCents: averageCentsOf(totalCents),
    });
  }

  private static buildAccumulatedBalanceRow(balanceRow: MonthlyTotalsRow): MonthlyTotalsRow {
    let running = 0;
    const cells = balanceRow.monthCells.map((cell) => {
      running += cell.amountCents;
      return running;
    });
    return Object.freeze({
      monthCells: cells.map((cents) => Money.fromCentsOrZero(cents)),
      totalCents: balanceRow.totalCents,
      averageCents: 0,
    });
  }

  private static buildTagRows(
    monthlySummaries: readonly GlobalMonthlySummary[],
  ): AnnualTagRow[] {
    const tagsById = new Map<number, TagAccumulator>();

    for (const summary of monthlySummaries) {
      for (const entry of summary.tagBreakdown) {
        const accumulator =
          tagsById.get(entry.tagId) ?? { tagId: entry.tagId, tagName: entry.tagName, cells: zeroCells() };
        accumulator.cells[monthlySummaries.indexOf(summary)] += entry.amount.amountCents;
        tagsById.set(entry.tagId, accumulator);
      }
    }

    return [...tagsById.values()].sort(compareTagRows).map((accumulator) => {
      const totalCents = sumCents(accumulator.cells);
      return Object.freeze({
        tagId: accumulator.tagId,
        tagName: accumulator.tagName,
        monthCells: accumulator.cells.map((cents) => Money.fromCentsOrZero(cents)),
        totalCents,
        averageCents: averageCentsOf(totalCents),
      });
    });
  }
}
