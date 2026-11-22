import type { AccountId } from "@/domain/account/AccountId";
import type { Movement } from "@/domain/movement/Movement";
import type { MovementId } from "@/domain/movement/MovementId";
import type { SavingsAllocation } from "@/domain/savings/SavingsAllocation";
import type { SavingsAllocationId } from "@/domain/savings/SavingsAllocationId";

export interface DeductedMonthEntry {
  month: string;
  amountCents: number;
  backedByMovement: boolean;
}

export interface SavingsAllocationRepository {
  findByAccountId(accountId: AccountId): Promise<SavingsAllocation | null>;
  save(config: SavingsAllocation): Promise<SavingsAllocation>;
  isDeducted(allocationId: SavingsAllocationId, month: string): Promise<boolean>;
  registerMaterialization(
    config: SavingsAllocation,
    month: string,
    movement: Movement,
  ): Promise<boolean>;
  registerManualSavings(
    config: SavingsAllocation,
    month: string,
    movement: Movement,
  ): Promise<MovementId | null>;
  findDeductedAmount(allocationId: SavingsAllocationId, month: string): Promise<number | null>;
  findDeductedMovement(
    allocationId: SavingsAllocationId,
    month: string,
  ): Promise<Movement | null>;
  findDeductedMonthsOfYear(
    allocationId: SavingsAllocationId,
    year: string,
  ): Promise<readonly DeductedMonthEntry[]>;
  findDeductedMonthByMovement(movementId: MovementId): Promise<string | null>;
  withdrawDeductionForMovement(movementId: MovementId): Promise<boolean>;
}
