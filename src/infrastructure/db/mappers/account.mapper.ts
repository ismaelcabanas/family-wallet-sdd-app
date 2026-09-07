import type { AccountDTO } from "@/application/movement/dto";
import { Account } from "@/domain/account/Account";
import { AccountType } from "@/domain/account/AccountType";
import { MemberId } from "@/domain/member/MemberId";

import type { AccountRow } from "../schema/accounts";

export function mapRowToAccount(row: AccountRow): Account {
  return Account.rehydrate(
    row.id,
    row.name,
    row.type as AccountType,
    row.memberId === null ? null : MemberId(row.memberId),
  );
}

export function mapRowToAccountDTO(row: {
  id: number;
  name: string;
  type: string;
  memberName: string | null;
}): AccountDTO {
  return {
    id: row.id,
    name: row.name,
    type: row.type as AccountDTO["type"],
    memberName: row.memberName,
  };
}
