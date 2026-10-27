import type { AccountId } from "@/domain/account/AccountId";

import { toSavingsAllocationDTO, type SavingsAllocationDTO } from "./dto";
import type { SavingsAllocationRepository } from "./SavingsAllocationRepository";

export class GetSavingsAllocation {
  constructor(private readonly savingsAllocations: SavingsAllocationRepository) {}

  async execute(accountId: AccountId): Promise<SavingsAllocationDTO | null> {
    const config = await this.savingsAllocations.findByAccountId(accountId);
    return config === null ? null : toSavingsAllocationDTO(config);
  }
}
