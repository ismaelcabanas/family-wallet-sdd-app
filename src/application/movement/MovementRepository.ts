import type { AccountId } from "@/domain/account/AccountId";
import type { Movement } from "@/domain/movement/Movement";
import type { MovementId } from "@/domain/movement/MovementId";

import type { MovementDTO } from "./dto";

export interface MovementRepository {
  create(movement: Movement): Promise<MovementId>;
  listByMonthAndAccount(accountId: AccountId, month: string): Promise<MovementDTO[]>;
  findById(id: MovementId): Promise<Movement | null>;
  update(movement: Movement): Promise<void>;
  delete(id: MovementId): Promise<void>;
}
