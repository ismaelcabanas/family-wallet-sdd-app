import { MemberNotFoundError, DuplicateMemberNameError } from "@/domain/member/MemberErrors";
import type { Member } from "@/domain/member/Member";
import type { MemberId } from "@/domain/member/MemberId";

import type { MemberRepository } from "./MemberRepository";

export class RenameMember {
  constructor(private readonly members: MemberRepository) {}

  async execute(input: { id: MemberId; name: string }): Promise<Member> {
    const member = await this.members.findById(input.id);
    if (member === null) {
      throw new MemberNotFoundError();
    }

    const renamed = member.rename(input.name);

    const existing = await this.members.findByName(renamed.name);
    if (existing !== null && existing.id !== member.id) {
      throw new DuplicateMemberNameError(renamed.name);
    }

    return this.members.update(renamed);
  }
}
