import {
  GlobalMonthlySummary,
  type GlobalSummaryMovementInput,
  type SummaryAccountRef,
} from "@/domain/movement/GlobalMonthlySummary";

import type { GlobalMonthlySummaryDTO } from "./dto";
import type { AccountRepository } from "../account/AccountRepository";
import type { MovementRepository } from "./MovementRepository";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export class GetGlobalMonthlySummary {
  constructor(
    private readonly movements: MovementRepository,
    private readonly accounts: AccountRepository,
  ) {}

  async execute(month: string): Promise<GlobalMonthlySummaryDTO> {
    if (!MONTH_PATTERN.test(month)) {
      throw new Error(`Mes inválido: ${month} (se espera YYYY-MM)`);
    }

    const [movementDtos, accountDtos] = await Promise.all([
      this.movements.listByMonth(month),
      this.accounts.findAll(),
    ]);

    const inputs: GlobalSummaryMovementInput[] = movementDtos.map((dto) => ({
      type: dto.type,
      nature: dto.nature,
      amountCents: dto.amountCents,
      tags: dto.tags.map((tag) => ({ id: tag.id, name: tag.name })),
      accountId: dto.accountId,
    }));
    const accounts: SummaryAccountRef[] = accountDtos.map((dto) => ({
      id: dto.id,
      type: dto.type,
      memberId: dto.memberId,
      memberName: dto.memberName,
    }));

    const summary = GlobalMonthlySummary.fromMovements(inputs, accounts);
    return {
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
    };
  }
}
