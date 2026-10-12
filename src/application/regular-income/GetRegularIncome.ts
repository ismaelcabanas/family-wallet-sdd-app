import type { AccountId } from "@/domain/account/AccountId";

import { toRegularIncomeDTO, type RegularIncomeDTO } from "./dto";
import type { RegularIncomeRepository } from "./RegularIncomeRepository";

export class GetRegularIncome {
  constructor(private readonly regularIncomes: RegularIncomeRepository) {}

  async execute(accountId: AccountId): Promise<RegularIncomeDTO | null> {
    const config = await this.regularIncomes.findByAccountId(accountId);
    return config === null ? null : toRegularIncomeDTO(config);
  }
}
