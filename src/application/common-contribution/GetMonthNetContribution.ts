import type { AccountId } from "@/domain/account/AccountId";

import type { CommonContributionRepository } from "./CommonContributionRepository";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export interface MonthNetContributionDTO {
  configured: boolean;
  amountCents: number;
}

export class GetMonthNetContribution {
  constructor(private readonly commonContributions: CommonContributionRepository) {}

  async execute(accountId: AccountId, month: string): Promise<MonthNetContributionDTO> {
    if (!MONTH_PATTERN.test(month)) {
      throw new Error(`Mes inválido: ${month} (se espera YYYY-MM)`);
    }

    const config = await this.commonContributions.findByAccountId(accountId);
    if (config === null || config.id === null) {
      return { configured: false, amountCents: 0 };
    }

    const movement = await this.commonContributions.findMaterializedMovement(config.id, month);
    return { configured: true, amountCents: movement?.amount.amountCents ?? 0 };
  }
}
