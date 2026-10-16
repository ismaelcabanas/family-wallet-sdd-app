import type { AccountRepository } from "../account/AccountRepository";
import type { RegularIncomeRepository } from "../regular-income/RegularIncomeRepository";
import { AccountId } from "@/domain/account/AccountId";
import { AccountNotFoundError } from "@/domain/account/AccountErrors";
import { CommonContribution } from "@/domain/common-contribution/CommonContribution";
import { ContributionPercentage } from "@/domain/common-contribution/ContributionPercentage";
import {
  InvalidCommonContributionError,
  MissingRegularIncomeError,
  SharedAccountContributionError,
} from "@/domain/common-contribution/CommonContributionErrors";

import { toCommonContributionDTO, type CommonContributionDTO } from "./dto";
import type { CommonContributionRepository } from "./CommonContributionRepository";

export interface ConfigureCommonContributionInput {
  accountId: number;
  percentageBasisPoints: number;
  currentMonth: string;
}

export class ConfigureCommonContribution {
  constructor(
    private readonly commonContributions: CommonContributionRepository,
    private readonly regularIncomes: RegularIncomeRepository,
    private readonly accounts: AccountRepository,
  ) {}

  async execute(input: ConfigureCommonContributionInput): Promise<CommonContributionDTO> {
    const accounts = await this.accounts.findAll();
    const account = accounts.find((candidate) => candidate.id === input.accountId);
    if (account === undefined) {
      throw new AccountNotFoundError();
    }
    if (account.type === "shared") {
      throw new SharedAccountContributionError();
    }

    const accountId = AccountId(input.accountId);
    const income = await this.regularIncomes.findByAccountId(accountId);
    if (income === null) {
      throw new MissingRegularIncomeError();
    }

    const percentage = ContributionPercentage.fromBasisPoints(input.percentageBasisPoints);
    if (percentage.appliedToCents(income.amount.amountCents) < 1) {
      throw new InvalidCommonContributionError(
        "percentage",
        "El porcentaje aplicado a tu ingreso regular debe resultar en al menos 0,01 €.",
      );
    }

    const existing = await this.commonContributions.findByAccountId(accountId);
    let saved: CommonContribution;
    if (existing === null) {
      saved = await this.commonContributions.save(
        CommonContribution.create({
          accountId,
          percentage,
          active: true,
          activatedAtMonth: input.currentMonth,
        }),
      );
    } else {
      let updated = existing.update({ percentage });
      if (!existing.active) {
        updated = updated.activate(input.currentMonth);
      }
      saved = await this.commonContributions.save(updated);
    }

    return toCommonContributionDTO(saved);
  }
}
