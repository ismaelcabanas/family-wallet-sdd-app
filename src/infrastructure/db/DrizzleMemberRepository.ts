import type { MemberRepository } from "@/application/member/MemberRepository";
import { Member } from "@/domain/member/Member";
import { asc } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

import { mapRowToMember } from "./mappers/member.mapper";
import { members } from "./schema/members";
import type * as schema from "./schema";

export class DrizzleMemberRepository implements MemberRepository {
  constructor(private readonly db: LibSQLDatabase<typeof schema>) {}

  async findAll(): Promise<Member[]> {
    const rows = await this.db.select().from(members).orderBy(asc(members.id));
    return rows.map(mapRowToMember);
  }
}
