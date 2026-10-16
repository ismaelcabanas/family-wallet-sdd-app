import { describe, expect, it } from "vitest";

import { AccountId } from "@/domain/account/AccountId";
import { CommonContribution } from "@/domain/common-contribution/CommonContribution";
import { CommonContributionId } from "@/domain/common-contribution/CommonContributionId";
import { ContributionPercentage } from "@/domain/common-contribution/ContributionPercentage";

import { GetCommonContribution } from "./GetCommonContribution";
import type { CommonContributionRepository } from "./CommonContributionRepository";

class InMemoryCommonContributionRepository implements CommonContributionRepository {
  constructor(private config: CommonContribution | null) {}

  async findByAccountId(): Promise<CommonContribution | null> {
    return this.config;
  }

  async save(config: CommonContribution): Promise<CommonContribution> {
    this.config = config;
    return config;
  }

  async isMaterialized(): Promise<boolean> {
    return false;
  }

  async registerMaterialization(): Promise<boolean> {
    return false;
  }
}

const ACCOUNT_ID = AccountId(1);

function persistedConfig() {
  return CommonContribution.rehydrate(CommonContributionId(4), {
    accountId: ACCOUNT_ID,
    percentage: ContributionPercentage.fromBasisPoints(2500),
    active: true,
    activatedAtMonth: "2026-08",
  });
}

describe("GetCommonContribution", () => {
  it("devuelve el DTO cuando existe config", async () => {
    const useCase = new GetCommonContribution(new InMemoryCommonContributionRepository(persistedConfig()));

    const dto = await useCase.execute(ACCOUNT_ID);

    expect(dto).toEqual({
      accountId: 1,
      percentageBasisPoints: 2500,
      active: true,
      activatedAtMonth: "2026-08",
    });
  });

  it("devuelve null cuando no existe config", async () => {
    const useCase = new GetCommonContribution(new InMemoryCommonContributionRepository(null));

    const dto = await useCase.execute(ACCOUNT_ID);

    expect(dto).toBeNull();
  });
});
