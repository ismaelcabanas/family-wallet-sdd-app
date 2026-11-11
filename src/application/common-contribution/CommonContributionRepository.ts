import type { AccountId } from "@/domain/account/AccountId";
import type { Movement } from "@/domain/movement/Movement";
import type { MovementId } from "@/domain/movement/MovementId";
import type { CommonContribution } from "@/domain/common-contribution/CommonContribution";
import type { CommonContributionId } from "@/domain/common-contribution/CommonContributionId";

export interface CommonContributionRepository {
  findByAccountId(accountId: AccountId): Promise<CommonContribution | null>;
  save(config: CommonContribution): Promise<CommonContribution>;
  isMaterialized(contributionId: CommonContributionId, month: string): Promise<boolean>;
  registerMaterialization(
    config: CommonContribution,
    month: string,
    movement: Movement,
  ): Promise<boolean>;
  registerManualContribution(
    config: CommonContribution,
    month: string,
    movement: Movement,
  ): Promise<MovementId | null>;
  findMaterializedMovement(
    contributionId: CommonContributionId,
    month: string,
  ): Promise<Movement | null>;
  findMaterializedMonthByMovement(movementId: MovementId): Promise<string | null>;
  withdrawMaterialization(
    contributionId: CommonContributionId,
    month: string,
  ): Promise<boolean>;
  withdrawMaterializationForMovement(movementId: MovementId): Promise<boolean>;
}
