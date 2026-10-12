import type { AccountId } from "@/domain/account/AccountId";
import type { Movement } from "@/domain/movement/Movement";
import type { RegularIncome } from "@/domain/regular-income/RegularIncome";
import type { RegularIncomeId } from "@/domain/regular-income/RegularIncomeId";

export interface RegularIncomeRepository {
  findByAccountId(accountId: AccountId): Promise<RegularIncome | null>;
  save(config: RegularIncome): Promise<RegularIncome>;
  isMaterialized(regularIncomeId: RegularIncomeId, month: string): Promise<boolean>;
  registerMaterialization(
    config: RegularIncome,
    month: string,
    movement: Movement,
  ): Promise<boolean>;
}
