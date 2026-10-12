import { AccountId } from "../account/AccountId";
import { Money } from "../movement/Money";
import { lastDayOfMonth } from "../shared/calendar";
import { InvalidRegularIncomeError } from "./RegularIncomeErrors";
import { RegularIncomeId } from "./RegularIncomeId";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export interface RegularIncomeInput {
  accountId: AccountId;
  amount: Money;
  dayOfMonth: number;
  note: string;
  active: boolean;
  activatedAtMonth: string;
}

export interface RegularIncomePersistence {
  id: number;
  accountId: AccountId;
  amount: Money;
  dayOfMonth: number;
  note: string;
  active: boolean;
  activatedAtMonth: string;
}

export interface RegularIncomeUpdateFields {
  amount?: Money;
  dayOfMonth?: number;
  note?: string;
}

type ValidatedRegularIncomeState = [
  accountId: AccountId,
  amount: Money,
  dayOfMonth: number,
  note: string,
  active: boolean,
  activatedAtMonth: string,
];

function buildValidatedState(input: RegularIncomeInput): ValidatedRegularIncomeState {
  const note = input.note.trim();
  if (note === "") {
    throw new InvalidRegularIncomeError("note", "La nota es obligatoria.");
  }

  if (!Number.isInteger(input.dayOfMonth) || input.dayOfMonth < 1 || input.dayOfMonth > 31) {
    throw new InvalidRegularIncomeError("dayOfMonth", "El día del mes debe estar entre 1 y 31.");
  }

  if (!MONTH_PATTERN.test(input.activatedAtMonth)) {
    throw new InvalidRegularIncomeError("activatedAtMonth", "Indica un mes de activación válido.");
  }

  return [
    input.accountId,
    input.amount,
    input.dayOfMonth,
    note,
    input.active,
    input.activatedAtMonth,
  ];
}

export class RegularIncome {
  readonly id: RegularIncomeId | null;
  readonly accountId: AccountId;
  readonly amount: Money;
  readonly dayOfMonth: number;
  readonly note: string;
  readonly active: boolean;
  readonly activatedAtMonth: string;

  private constructor(
    id: RegularIncomeId | null,
    accountId: AccountId,
    amount: Money,
    dayOfMonth: number,
    note: string,
    active: boolean,
    activatedAtMonth: string,
  ) {
    this.id = id;
    this.accountId = accountId;
    this.amount = amount;
    this.dayOfMonth = dayOfMonth;
    this.note = note;
    this.active = active;
    this.activatedAtMonth = activatedAtMonth;
    Object.freeze(this);
  }

  static create(input: RegularIncomeInput): RegularIncome {
    return new RegularIncome(null, ...buildValidatedState(input));
  }

  static rehydrate(persistence: RegularIncomePersistence): RegularIncome {
    return new RegularIncome(
      RegularIncomeId(persistence.id),
      ...buildValidatedState({
        accountId: persistence.accountId,
        amount: persistence.amount,
        dayOfMonth: persistence.dayOfMonth,
        note: persistence.note,
        active: persistence.active,
        activatedAtMonth: persistence.activatedAtMonth,
      }),
    );
  }

  update(fields: RegularIncomeUpdateFields): RegularIncome {
    return new RegularIncome(
      this.id,
      ...buildValidatedState({
        accountId: this.accountId,
        amount: fields.amount ?? this.amount,
        dayOfMonth: fields.dayOfMonth ?? this.dayOfMonth,
        note: fields.note ?? this.note,
        active: this.active,
        activatedAtMonth: this.activatedAtMonth,
      }),
    );
  }

  deactivate(): RegularIncome {
    return new RegularIncome(
      this.id,
      ...buildValidatedState({
        accountId: this.accountId,
        amount: this.amount,
        dayOfMonth: this.dayOfMonth,
        note: this.note,
        active: false,
        activatedAtMonth: this.activatedAtMonth,
      }),
    );
  }

  activate(currentMonth: string): RegularIncome {
    return new RegularIncome(
      this.id,
      ...buildValidatedState({
        accountId: this.accountId,
        amount: this.amount,
        dayOfMonth: this.dayOfMonth,
        note: this.note,
        active: true,
        activatedAtMonth: currentMonth,
      }),
    );
  }

  dueDateForMonth(month: string): string {
    const day = Math.min(this.dayOfMonth, lastDayOfMonth(month));
    return `${month}-${String(day).padStart(2, "0")}`;
  }
}
