import type { AccountId } from "@/domain/account/AccountId";

import type { SavingsAllocationRepository } from "./SavingsAllocationRepository";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export interface MonthSavingsDTO {
  configured: boolean;
  amountCents: number;
}

export class GetMonthSavings {
  constructor(private readonly savingsAllocations: SavingsAllocationRepository) {}

  async execute(accountId: AccountId, month: string): Promise<MonthSavingsDTO> {
    if (!MONTH_PATTERN.test(month)) {
      throw new Error(`Mes inválido: ${month} (se espera YYYY-MM)`);
    }

    const config = await this.savingsAllocations.findByAccountId(accountId);
    if (config === null || config.id === null) {
      return { configured: false, amountCents: 0 };
    }

    const amountCents = await this.savingsAllocations.findDeductedAmount(config.id, month);
    return { configured: true, amountCents: amountCents ?? 0 };
  }
}
