import { AccountId } from "@/domain/account/AccountId";
import { CommonContribution } from "@/domain/common-contribution/CommonContribution";
import { ContributionPercentage } from "@/domain/common-contribution/ContributionPercentage";

import type { CommonContributionRow, NewCommonContributionRow } from "../schema/common-contributions";

export function mapCommonContributionToRow(config: CommonContribution): NewCommonContributionRow {
  return {
    ...(config.id === null ? {} : { id: config.id as number }),
    accountId: config.accountId as number,
    percentageBasisPoints: config.percentage.basisPoints,
    active: config.active ? 1 : 0,
    activatedAtMonth: config.activatedAtMonth,
    createdAt: new Date().toISOString(),
  };
}

export function mapRowToCommonContribution(row: CommonContributionRow): CommonContribution {
  return CommonContribution.rehydrate(row.id, {
    accountId: AccountId(row.accountId),
    percentage: ContributionPercentage.fromBasisPoints(row.percentageBasisPoints),
    active: row.active === 1,
    activatedAtMonth: row.activatedAtMonth,
  });
}
