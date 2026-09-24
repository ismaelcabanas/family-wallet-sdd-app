import {
  AnnualIncomeStatement,
  type AnnualStatementMovementInput,
  type MemberRef,
} from "@/domain/movement/AnnualIncomeStatement";
import type { SummaryAccountRef } from "@/domain/movement/GlobalMonthlySummary";

import type { AnnualIncomeStatementDTO } from "./dto";
import type { AccountRepository } from "../account/AccountRepository";
import type { MemberRepository } from "../member/MemberRepository";
import type { MovementRepository } from "./MovementRepository";

const YEAR_PATTERN = /^\d{4}$/;

export class GetAnnualIncomeStatement {
  constructor(
    private readonly movements: MovementRepository,
    private readonly accounts: AccountRepository,
    private readonly members: MemberRepository,
  ) {}

  async execute(year: string): Promise<AnnualIncomeStatementDTO> {
    if (!YEAR_PATTERN.test(year)) {
      throw new Error(`Año inválido: ${year} (se espera YYYY)`);
    }

    const [movementDtos, accountDtos, members] = await Promise.all([
      this.movements.listByYear(year),
      this.accounts.findAll(),
      this.members.findAll(),
    ]);

    const inputs: AnnualStatementMovementInput[] = movementDtos.map((dto) => ({
      type: dto.type,
      nature: dto.nature,
      amountCents: dto.amountCents,
      tags: dto.tags.map((tag) => ({ id: tag.id, name: tag.name })),
      accountId: dto.accountId,
      date: dto.date,
    }));
    const accounts: SummaryAccountRef[] = accountDtos.map((dto) => ({
      id: dto.id,
      type: dto.type,
      memberId: dto.memberId,
      memberName: dto.memberName,
    }));
    const memberRefs: MemberRef[] = members.map((member) => ({
      id: member.id as number,
      name: member.name,
    }));

    const statement = AnnualIncomeStatement.fromMovements(inputs, accounts, memberRefs);
    return {
      monthlySummaries: statement.monthlySummaries.map((summary) => ({
        incomeTotalCents: summary.incomeTotal.amountCents,
        expenseTotalCents: summary.expenseTotal.amountCents,
        sharedExpenseCents: summary.sharedExpenseTotal.amountCents,
        personalExpenseCents: summary.personalExpenseTotal.amountCents,
        monthBalanceCents: summary.monthBalance.amountCents,
        tagBreakdown: summary.tagBreakdown.map((entry) => ({
          tagId: entry.tagId,
          tagName: entry.tagName,
          amountCents: entry.amount.amountCents,
        })),
        memberBreakdown: summary.memberBreakdown.map((entry) => ({
          memberId: entry.memberId,
          memberName: entry.memberName,
          personalCents: entry.personal.amountCents,
          sharedCents: entry.shared.amountCents,
        })),
      })),
      memberIncomeRows: statement.memberIncomeRows.map((row) => ({
        memberId: row.memberId,
        memberName: row.memberName,
        monthlyIncomeCents: row.monthCells.map((cell) => cell.amountCents),
        totalCents: row.totalCents,
        averageCents: row.averageCents,
      })),
      totalIncomeRow: toTotalsRowDTO(statement.totalIncomeRow),
      expenseRealRow: toTotalsRowDTO(statement.expenseRealRow),
      noPersonalExpenseRow: toTotalsRowDTO(statement.noPersonalExpenseRow),
      balanceRow: toTotalsRowDTO(statement.balanceRow),
      accumulatedBalanceRow: {
        monthlyCents: statement.accumulatedBalanceRow.monthCells.map((cell) => cell.amountCents),
        totalCents: statement.accumulatedBalanceRow.totalCents,
      },
      tagRows: statement.tagRows.map((row) => ({
        tagId: row.tagId,
        tagName: row.tagName,
        monthlyCents: row.monthCells.map((cell) => cell.amountCents),
        totalCents: row.totalCents,
        averageCents: row.averageCents,
      })),
    };
  }
}

function toTotalsRowDTO(row: {
  monthCells: readonly { amountCents: number }[];
  totalCents: number;
  averageCents: number;
}) {
  return {
    monthlyCents: row.monthCells.map((cell) => cell.amountCents),
    totalCents: row.totalCents,
    averageCents: row.averageCents,
  };
}
