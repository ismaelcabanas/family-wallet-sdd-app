import type { AccountId } from "@/domain/account/AccountId";
import { SavingsAllocationNotFoundError } from "@/domain/savings/SavingsAllocationErrors";

import { toSavingsAllocationDTO, type SavingsAllocationDTO } from "./dto";
import type { SavingsAllocationRepository } from "./SavingsAllocationRepository";

export class DeactivateSavingsAllocation {
  constructor(private readonly savingsAllocations: SavingsAllocationRepository) {}

  async execute(accountId: AccountId): Promise<SavingsAllocationDTO> {
    const existing = await this.savingsAllocations.findByAccountId(accountId);
    if (existing === null) {
      throw new SavingsAllocationNotFoundError();
    }

    const saved = await this.savingsAllocations.save(existing.deactivate());
    return toSavingsAllocationDTO(saved);
  }
}
