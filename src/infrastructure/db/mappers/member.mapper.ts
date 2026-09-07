import { Member } from "@/domain/member/Member";

import type { MemberRow } from "../schema/members";

export function mapRowToMember(row: MemberRow): Member {
  return Member.rehydrate(row.id, row.name);
}
