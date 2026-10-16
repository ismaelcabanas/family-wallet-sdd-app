import type { AccountId } from "@/domain/account/AccountId";

import { toCommonContributionDTO, type CommonContributionDTO } from "./dto";
import type { CommonContributionRepository } from "./CommonContributionRepository";

export class GetCommonContribution {
  constructor(private readonly commonContributions: CommonContributionRepository) {}

  async execute(accountId: AccountId): Promise<CommonContributionDTO | null> {
    const config = await this.commonContributions.findByAccountId(accountId);
    return config === null ? null : toCommonContributionDTO(config);
  }
}
