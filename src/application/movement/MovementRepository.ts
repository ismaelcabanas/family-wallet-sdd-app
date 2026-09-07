import type { AccountId } from "@/domain/account/AccountId";
import type { Movement } from "@/domain/movement/Movement";
import type { MovementId } from "@/domain/movement/MovementId";

import type { MovementDTO } from "./dto";

export interface MovementRepository {
  create(movement: Movement): Promise<MovementId>;
  listByMonthAndAccount(accountId: AccountId, month: string): Promise<MovementDTO[]>;
}
