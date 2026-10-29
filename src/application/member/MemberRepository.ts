import type { Member } from "@/domain/member/Member";
import type { MemberId } from "@/domain/member/MemberId";

export interface MemberRepository {
  findAll(): Promise<Member[]>;
  findById(id: MemberId): Promise<Member | null>;
  findByName(name: string): Promise<Member | null>;
  update(member: Member): Promise<Member>;
}
