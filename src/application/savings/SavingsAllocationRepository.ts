import type { AccountId } from "@/domain/account/AccountId";
import type { SavingsAllocation } from "@/domain/savings/SavingsAllocation";
import type { SavingsAllocationId } from "@/domain/savings/SavingsAllocationId";

export interface SavingsAllocationRepository {
  findByAccountId(accountId: AccountId): Promise<SavingsAllocation | null>;
  save(config: SavingsAllocation): Promise<SavingsAllocation>;
  isDeducted(allocationId: SavingsAllocationId, month: string): Promise<boolean>;
  registerDeduction(
    config: SavingsAllocation,
    month: string,
    amountCents: number,
  ): Promise<boolean>;
  findDeductedAmount(allocationId: SavingsAllocationId, month: string): Promise<number | null>;
}
