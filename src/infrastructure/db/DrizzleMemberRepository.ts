import type { MemberRepository } from "@/application/member/MemberRepository";
import { Member } from "@/domain/member/Member";
import { DuplicateMemberNameError } from "@/domain/member/MemberErrors";
import type { MemberId } from "@/domain/member/MemberId";
import { asc, eq, sql } from "drizzle-orm";
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

  async findById(id: MemberId): Promise<Member | null> {
    const rows = await this.db.select().from(members).where(eq(members.id, id)).limit(1);
    return rows.length > 0 ? mapRowToMember(rows[0]) : null;
  }

  async findByName(name: string): Promise<Member | null> {
    const rows = await this.db
      .select()
      .from(members)
      .where(sql`lower(${members.name}) = lower(${name})`)
      .limit(1);
    return rows.length > 0 ? mapRowToMember(rows[0]) : null;
  }

  async update(member: Member): Promise<Member> {
    if (member.id === null) {
      throw new RangeError("update requiere un miembro persistido");
    }
    try {
      const rows = await this.db
        .update(members)
        .set({ name: member.name })
        .where(eq(members.id, member.id))
        .returning();
      return mapRowToMember(rows[0]);
    } catch (error) {
      throw this.translateUniqueViolation(error, member);
    }
  }

  private translateUniqueViolation(error: unknown, member: Member): Error {
    const messages = [
      error instanceof Error ? error.message : "",
      error instanceof Error && error.cause instanceof Error ? error.cause.message : "",
    ];
    if (messages.some((message) => message.includes("members_name_nocase_uq"))) {
      return new DuplicateMemberNameError(member.name);
    }
    return error as Error;
  }
}
