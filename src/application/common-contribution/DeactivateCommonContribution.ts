import type { AccountId } from "@/domain/account/AccountId";
import { CommonContributionNotFoundError } from "@/domain/common-contribution/CommonContributionErrors";

import { toCommonContributionDTO, type CommonContributionDTO } from "./dto";
import type { CommonContributionRepository } from "./CommonContributionRepository";

export class DeactivateCommonContribution {
  constructor(private readonly commonContributions: CommonContributionRepository) {}

  async execute(accountId: AccountId): Promise<CommonContributionDTO> {
    const existing = await this.commonContributions.findByAccountId(accountId);
    if (existing === null) {
      throw new CommonContributionNotFoundError();
    }

    const saved = await this.commonContributions.save(existing.deactivate());
    return toCommonContributionDTO(saved);
  }
}
