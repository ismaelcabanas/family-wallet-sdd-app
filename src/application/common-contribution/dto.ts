import type { CommonContribution } from "@/domain/common-contribution/CommonContribution";

export interface CommonContributionDTO {
  accountId: number;
  percentageBasisPoints: number;
  active: boolean;
  activatedAtMonth: string;
}

export function toCommonContributionDTO(config: CommonContribution): CommonContributionDTO {
  return {
    accountId: config.accountId as number,
    percentageBasisPoints: config.percentage.basisPoints,
    active: config.active,
    activatedAtMonth: config.activatedAtMonth,
  };
}
