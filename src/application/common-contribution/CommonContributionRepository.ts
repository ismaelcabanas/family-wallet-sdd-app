import type { AccountId } from "@/domain/account/AccountId";
import type { Movement } from "@/domain/movement/Movement";
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
}
