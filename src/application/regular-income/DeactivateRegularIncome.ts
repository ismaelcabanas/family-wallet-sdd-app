import type { AccountId } from "@/domain/account/AccountId";
import { RegularIncomeNotFoundError } from "@/domain/regular-income/RegularIncomeErrors";

import { toRegularIncomeDTO, type RegularIncomeDTO } from "./dto";
import type { RegularIncomeRepository } from "./RegularIncomeRepository";

export class DeactivateRegularIncome {
  constructor(private readonly regularIncomes: RegularIncomeRepository) {}

  async execute(accountId: AccountId): Promise<RegularIncomeDTO> {
    const existing = await this.regularIncomes.findByAccountId(accountId);
    if (existing === null) {
      throw new RegularIncomeNotFoundError();
    }

    const saved = await this.regularIncomes.save(existing.deactivate());
    return toRegularIncomeDTO(saved);
  }
}
