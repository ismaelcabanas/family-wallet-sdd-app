import { AccountId } from "@/domain/account/AccountId";
import { MonthlyClosure, type ClosureMovementInput } from "@/domain/movement/MonthlyClosure";

import type { MonthlyClosureDTO } from "./dto";
import type { MovementRepository } from "./MovementRepository";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export class GetMonthlyClosure {
  constructor(private readonly movements: MovementRepository) {}

  async execute(accountId: number, month: string): Promise<MonthlyClosureDTO> {
    if (!MONTH_PATTERN.test(month)) {
      throw new Error(`Mes inválido: ${month} (se espera YYYY-MM)`);
    }

    const movementDtos = await this.movements.listByMonthAndAccount(AccountId(accountId), month);
    const inputs: ClosureMovementInput[] = movementDtos.map((dto) => ({
      type: dto.type,
      nature: dto.nature,
      amountCents: dto.amountCents,
      tags: dto.tags.map((tag) => ({ id: tag.id, name: tag.name })),
    }));

    const closure = MonthlyClosure.fromMovements(inputs);
    return {
      incomeTotalCents: closure.incomeTotal.amountCents,
      expenseTotalCents: closure.expenseTotal.amountCents,
      sharedExpenseCents: closure.sharedExpenseTotal.amountCents,
      personalExpenseCents: closure.personalExpenseTotal.amountCents,
      monthBalanceCents: closure.monthBalance.amountCents,
      tagBreakdown: closure.tagBreakdown.map((entry) => ({
        tagId: entry.tagId,
        tagName: entry.tagName,
        amountCents: entry.amount.amountCents,
      })),
    };
  }
}
