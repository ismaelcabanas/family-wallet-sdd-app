import type { AccountRepository } from "../account/AccountRepository";
import { AccountId } from "@/domain/account/AccountId";
import { AccountNotFoundError } from "@/domain/account/AccountErrors";
import { Money } from "@/domain/movement/Money";
import { RegularIncome } from "@/domain/regular-income/RegularIncome";
import { SharedAccountIncomeError } from "@/domain/regular-income/RegularIncomeErrors";

import { toRegularIncomeDTO, type RegularIncomeDTO } from "./dto";
import type { RegularIncomeRepository } from "./RegularIncomeRepository";

export interface ConfigureRegularIncomeInput {
  accountId: number;
  amountCents: number;
  dayOfMonth: number;
  note: string | null;
  currentMonth: string;
}

export class ConfigureRegularIncome {
  constructor(
    private readonly regularIncomes: RegularIncomeRepository,
    private readonly accounts: AccountRepository,
  ) {}

  async execute(input: ConfigureRegularIncomeInput): Promise<RegularIncomeDTO> {
    const accounts = await this.accounts.findAll();
    const account = accounts.find((candidate) => candidate.id === input.accountId);
    if (account === undefined) {
      throw new AccountNotFoundError();
    }
    if (account.type === "shared") {
      throw new SharedAccountIncomeError();
    }

    const note = input.note?.trim() || `Ingreso regular de ${account.memberName ?? "miembro"}`;
    const accountId = AccountId(input.accountId);
    const amount = Money.fromCents(input.amountCents);

    const existing = await this.regularIncomes.findByAccountId(accountId);
    let saved: RegularIncome;
    if (existing === null) {
      saved = await this.regularIncomes.save(
        RegularIncome.create({
          accountId,
          amount,
          dayOfMonth: input.dayOfMonth,
          note,
          active: true,
          activatedAtMonth: input.currentMonth,
        }),
      );
    } else {
      let updated = existing.update({
        amount,
        dayOfMonth: input.dayOfMonth,
        note,
      });
      if (!existing.active) {
        updated = updated.activate(input.currentMonth);
      }
      saved = await this.regularIncomes.save(updated);
    }

    return toRegularIncomeDTO(saved);
  }
}
