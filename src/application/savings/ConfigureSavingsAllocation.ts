import type { AccountRepository } from "../account/AccountRepository";
import type { RegularIncomeRepository } from "../regular-income/RegularIncomeRepository";
import { AccountId } from "@/domain/account/AccountId";
import { AccountNotFoundError } from "@/domain/account/AccountErrors";
import { SavingsAllocation } from "@/domain/savings/SavingsAllocation";
import { SavingsPercentage } from "@/domain/savings/SavingsPercentage";
import {
  InvalidSavingsAllocationError,
  MissingRegularIncomeError,
  SharedAccountSavingsError,
} from "@/domain/savings/SavingsAllocationErrors";

import { toSavingsAllocationDTO, type SavingsAllocationDTO } from "./dto";
import type { SavingsAllocationRepository } from "./SavingsAllocationRepository";

export interface ConfigureSavingsAllocationInput {
  accountId: number;
  percentage: number;
  currentMonth: string;
}

export class ConfigureSavingsAllocation {
  constructor(
    private readonly savingsAllocations: SavingsAllocationRepository,
    private readonly regularIncomes: RegularIncomeRepository,
    private readonly accounts: AccountRepository,
  ) {}

  async execute(input: ConfigureSavingsAllocationInput): Promise<SavingsAllocationDTO> {
    const accounts = await this.accounts.findAll();
    const account = accounts.find((candidate) => candidate.id === input.accountId);
    if (account === undefined) {
      throw new AccountNotFoundError();
    }
    if (account.type === "shared") {
      throw new SharedAccountSavingsError();
    }

    const accountId = AccountId(input.accountId);
    const income = await this.regularIncomes.findByAccountId(accountId);
    if (income === null) {
      throw new MissingRegularIncomeError();
    }

    const percentage = SavingsPercentage.fromPercent(input.percentage);
    if (percentage.appliedToCents(income.amount.amountCents) < 1) {
      throw new InvalidSavingsAllocationError(
        "percentage",
        "El porcentaje aplicado a tu ingreso regular debe resultar en al menos 0,01 €.",
      );
    }

    const existing = await this.savingsAllocations.findByAccountId(accountId);
    let saved: SavingsAllocation;
    if (existing === null) {
      saved = await this.savingsAllocations.save(
        SavingsAllocation.create({
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
      saved = await this.savingsAllocations.save(updated);
    }

    return toSavingsAllocationDTO(saved);
  }
}
