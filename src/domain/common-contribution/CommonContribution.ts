import { AccountId } from "../account/AccountId";
import { InvalidCommonContributionError } from "./CommonContributionErrors";
import { CommonContributionId } from "./CommonContributionId";
import { ContributionPercentage } from "./ContributionPercentage";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export interface CommonContributionInput {
  accountId: AccountId;
  percentage: ContributionPercentage;
  active: boolean;
  activatedAtMonth: string;
}

export interface CommonContributionUpdateFields {
  percentage?: ContributionPercentage;
}

type ValidatedCommonContributionState = [
  accountId: AccountId,
  percentage: ContributionPercentage,
  active: boolean,
  activatedAtMonth: string,
];

function buildValidatedState(input: CommonContributionInput): ValidatedCommonContributionState {
  if (!MONTH_PATTERN.test(input.activatedAtMonth)) {
    throw new InvalidCommonContributionError("activatedAtMonth", "El mes de activación no es válido.");
  }

  return [input.accountId, input.percentage, input.active, input.activatedAtMonth];
}

export class CommonContribution {
  readonly id: CommonContributionId | null;
  readonly accountId: AccountId;
  readonly percentage: ContributionPercentage;
  readonly active: boolean;
  readonly activatedAtMonth: string;

  private constructor(
    id: CommonContributionId | null,
    accountId: AccountId,
    percentage: ContributionPercentage,
    active: boolean,
    activatedAtMonth: string,
  ) {
    this.id = id;
    this.accountId = accountId;
    this.percentage = percentage;
    this.active = active;
    this.activatedAtMonth = activatedAtMonth;
    Object.freeze(this);
  }

  static create(input: CommonContributionInput): CommonContribution {
    return new CommonContribution(null, ...buildValidatedState(input));
  }

  static rehydrate(id: number, input: CommonContributionInput): CommonContribution {
    return new CommonContribution(CommonContributionId(id), ...buildValidatedState(input));
  }

  update(fields: CommonContributionUpdateFields): CommonContribution {
    return new CommonContribution(
      this.id,
      ...buildValidatedState({
        accountId: this.accountId,
        percentage: fields.percentage ?? this.percentage,
        active: this.active,
        activatedAtMonth: this.activatedAtMonth,
      }),
    );
  }

  deactivate(): CommonContribution {
    return new CommonContribution(
      this.id,
      ...buildValidatedState({
        accountId: this.accountId,
        percentage: this.percentage,
        active: false,
        activatedAtMonth: this.activatedAtMonth,
      }),
    );
  }

  activate(currentMonth: string): CommonContribution {
    return new CommonContribution(
      this.id,
      ...buildValidatedState({
        accountId: this.accountId,
        percentage: this.percentage,
        active: true,
        activatedAtMonth: currentMonth,
      }),
    );
  }

  dueDateForMonth(month: string): string {
    return `${month}-01`;
  }
}
