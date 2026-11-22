import type { SavingsAllocationRepository } from "@/application/savings/SavingsAllocationRepository";
import { AccountId } from "@/domain/account/AccountId";
import { MonthlyClosure, type ClosureMovementInput } from "@/domain/movement/MonthlyClosure";

import type { AnnualAccumulatedSavingsDTO } from "./dto";
import type { MovementRepository } from "./MovementRepository";
import { netMonthBalanceCents } from "./net-month-balance";

const YEAR_PATTERN = /^\d{4}$/;

export class GetAnnualAccumulatedSavings {
  constructor(
    private readonly movements: MovementRepository,
    private readonly savingsAllocations: SavingsAllocationRepository,
  ) {}

  async execute(accountId: number, year: string): Promise<AnnualAccumulatedSavingsDTO> {
    if (!YEAR_PATTERN.test(year)) {
      throw new Error(`Año inválido: ${year} (se espera YYYY)`);
    }

    const [movementDtos, config] = await Promise.all([
      this.movements.listByYearAndAccount(AccountId(accountId), year),
      this.savingsAllocations.findByAccountId(AccountId(accountId)),
    ]);

    const deductedMonths =
      config !== null && config.id !== null
        ? await this.savingsAllocations.findDeductedMonthsOfYear(config.id, year)
        : [];
    const savingsByMonth = new Map(deductedMonths.map((entry) => [entry.month, entry]));

    const movementsByMonth = new Map<string, ClosureMovementInput[]>();
    for (const dto of movementDtos) {
      const month = dto.date.slice(0, 7);
      const inputs = movementsByMonth.get(month) ?? [];
      inputs.push({
        type: dto.type,
        nature: dto.nature,
        amountCents: dto.amountCents,
        tag: dto.tag ? { id: dto.tag.id, name: dto.tag.name } : null,
      });
      movementsByMonth.set(month, inputs);
    }

    let accumulatedCents = 0;
    for (let month = 1; month <= 12; month += 1) {
      const monthKey = `${year}-${String(month).padStart(2, "0")}`;
      const closure = MonthlyClosure.fromMovements(movementsByMonth.get(monthKey) ?? []);
      const savings = savingsByMonth.get(monthKey) ?? { amountCents: 0, backedByMovement: false };
      accumulatedCents += netMonthBalanceCents(closure.monthBalance.amountCents, savings);
    }

    return { accumulatedCents };
  }
}
