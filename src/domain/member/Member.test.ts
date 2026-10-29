import { Member } from "./Member";
import { InvalidMemberError } from "./MemberErrors";
import { describe, expect, it } from "vitest";

describe("Member", () => {
  it("create trima y rechaza el nombre vacío", () => {
    expect(Member.create("  Isma  ").name).toBe("Isma");
    expect(() => Member.create("")).toThrowError(
      new InvalidMemberError("El nombre del miembro es obligatorio."),
    );
    expect(() => Member.create("   ")).toThrowError(
      new InvalidMemberError("El nombre del miembro es obligatorio."),
    );
  });

  it("rehydrate conserva id y nombre", () => {
    const member = Member.rehydrate(1, "Miembro A");
    expect(member.id).toBe(1);
    expect(member.name).toBe("Miembro A");
  });

  it("rename devuelve una nueva instancia congelada con el mismo id y el nombre trimado", () => {
    const member = Member.rehydrate(1, "Miembro A");

    const renamed = member.rename("Isma");

    expect(renamed).not.toBe(member);
    expect(renamed.id).toBe(1);
    expect(renamed.name).toBe("Isma");
    expect(Object.isFrozen(renamed)).toBe(true);
    expect(member.name).toBe("Miembro A");
  });

  it('rename("  Sole  ") → «Sole»', () => {
    const renamed = Member.rehydrate(2, "Miembro B").rename("  Sole  ");
    expect(renamed.name).toBe("Sole");
  });

  it('rename("") y rename("   ") lanzan InvalidMemberError con el literal congelado', () => {
    const member = Member.rehydrate(1, "Miembro A");
    expect(() => member.rename("")).toThrowError(
      new InvalidMemberError("El nombre del miembro es obligatorio."),
    );
    expect(() => member.rename("   ")).toThrowError(
      new InvalidMemberError("El nombre del miembro es obligatorio."),
    );
  });
});
