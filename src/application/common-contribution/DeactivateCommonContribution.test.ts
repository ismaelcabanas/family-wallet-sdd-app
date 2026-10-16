import { describe, expect, it } from "vitest";

import { AccountId } from "@/domain/account/AccountId";
import { CommonContribution } from "@/domain/common-contribution/CommonContribution";
import { CommonContributionId } from "@/domain/common-contribution/CommonContributionId";
import { ContributionPercentage } from "@/domain/common-contribution/ContributionPercentage";
import { CommonContributionNotFoundError } from "@/domain/common-contribution/CommonContributionErrors";

import { DeactivateCommonContribution } from "./DeactivateCommonContribution";
import type { CommonContributionRepository } from "./CommonContributionRepository";

class InMemoryCommonContributionRepository implements CommonContributionRepository {
  private config: CommonContribution | null;

  constructor(config: CommonContribution | null) {
    this.config = config;
  }

  async findByAccountId(accountId?: AccountId): Promise<CommonContribution | null> {
    void accountId;
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
    percentage: ContributionPercentage.fromBasisPoints(1250),
    active: true,
    activatedAtMonth: "2026-08",
  });
}

describe("DeactivateCommonContribution", () => {
  it("desactiva conservando valores y activatedAtMonth", async () => {
    const repo = new InMemoryCommonContributionRepository(persistedConfig());
    const useCase = new DeactivateCommonContribution(repo);

    const dto = await useCase.execute(ACCOUNT_ID);

    expect(dto).toEqual({
      accountId: 1,
      percentageBasisPoints: 1250,
      active: false,
      activatedAtMonth: "2026-08",
    });
    expect((await repo.findByAccountId(ACCOUNT_ID))?.active).toBe(false);
  });

  it("sin config → CommonContributionNotFoundError", async () => {
    const useCase = new DeactivateCommonContribution(new InMemoryCommonContributionRepository(null));

    await expect(useCase.execute(ACCOUNT_ID)).rejects.toThrowError(CommonContributionNotFoundError);
  });
});
