import { AccountId } from "@/domain/account/AccountId";

import type { MovementDTO } from "./dto";
import type { MovementRepository } from "./MovementRepository";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export class ListMovements {
  constructor(private readonly movements: MovementRepository) {}

  async execute(accountId: number, month: string): Promise<MovementDTO[]> {
    if (!MONTH_PATTERN.test(month)) {
      throw new Error(`Mes inválido: ${month} (se espera YYYY-MM)`);
    }
    return this.movements.listByMonthAndAccount(AccountId(accountId), month);
  }
}
