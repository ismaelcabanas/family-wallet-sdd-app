import { AccountId } from "../account/AccountId";
import { InvalidSavingsAllocationError } from "./SavingsAllocationErrors";
import { SavingsAllocationId } from "./SavingsAllocationId";
import { SavingsPercentage } from "./SavingsPercentage";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export interface SavingsAllocationInput {
  accountId: AccountId;
  percentage: SavingsPercentage;
  active: boolean;
  activatedAtMonth: string;
}

export interface SavingsAllocationUpdateFields {
  percentage?: SavingsPercentage;
}

type ValidatedSavingsAllocationState = [
  accountId: AccountId,
  percentage: SavingsPercentage,
  active: boolean,
  activatedAtMonth: string,
];

function buildValidatedState(input: SavingsAllocationInput): ValidatedSavingsAllocationState {
  if (!MONTH_PATTERN.test(input.activatedAtMonth)) {
    throw new InvalidSavingsAllocationError("activatedAtMonth", "El mes de activación no es válido.");
  }

  return [input.accountId, input.percentage, input.active, input.activatedAtMonth];
}

export class SavingsAllocation {
  readonly id: SavingsAllocationId | null;
  readonly accountId: AccountId;
  readonly percentage: SavingsPercentage;
  readonly active: boolean;
  readonly activatedAtMonth: string;

  private constructor(
    id: SavingsAllocationId | null,
    accountId: AccountId,
    percentage: SavingsPercentage,
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

  static create(input: SavingsAllocationInput): SavingsAllocation {
    return new SavingsAllocation(null, ...buildValidatedState(input));
  }

  static rehydrate(id: number, input: SavingsAllocationInput): SavingsAllocation {
    return new SavingsAllocation(SavingsAllocationId(id), ...buildValidatedState(input));
  }

  update(fields: SavingsAllocationUpdateFields): SavingsAllocation {
    return new SavingsAllocation(
      this.id,
      ...buildValidatedState({
        accountId: this.accountId,
        percentage: fields.percentage ?? this.percentage,
        active: this.active,
        activatedAtMonth: this.activatedAtMonth,
      }),
    );
  }

  deactivate(): SavingsAllocation {
    return new SavingsAllocation(
      this.id,
      ...buildValidatedState({
        accountId: this.accountId,
        percentage: this.percentage,
        active: false,
        activatedAtMonth: this.activatedAtMonth,
      }),
    );
  }

  activate(currentMonth: string): SavingsAllocation {
    return new SavingsAllocation(
      this.id,
      ...buildValidatedState({
        accountId: this.accountId,
        percentage: this.percentage,
        active: true,
        activatedAtMonth: currentMonth,
      }),
    );
  }
}
