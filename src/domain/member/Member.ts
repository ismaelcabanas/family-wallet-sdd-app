import { MemberId } from "./MemberId";
import { InvalidMemberError } from "./MemberErrors";

export class Member {
  readonly id: MemberId | null;
  readonly name: string;

  private constructor(id: MemberId | null, name: string) {
    this.id = id;
    this.name = name;
    Object.freeze(this);
  }

  static create(name: string): Member {
    const trimmed = name.trim();
    if (trimmed === "") {
      throw new InvalidMemberError("El nombre del miembro es obligatorio.");
    }
    return new Member(null, trimmed);
  }

  static rehydrate(id: number, name: string): Member {
    return new Member(MemberId(id), name);
  }
}
