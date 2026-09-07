import type { Member } from "@/domain/member/Member";

export interface MemberRepository {
  findAll(): Promise<Member[]>;
}
