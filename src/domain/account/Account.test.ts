import { MemberId } from "../member/MemberId";
import { Account } from "./Account";
import { AccountNotRenamableError, InvalidAccountError } from "./AccountErrors";
import { describe, expect, it } from "vitest";

describe("Account", () => {
  it("create de cuenta común trima y exige nombre no vacío", () => {
    expect(Account.create({ name: "  Cuenta común  ", type: "shared", memberId: null }).name).toBe(
      "Cuenta común",
    );
    expect(() => Account.create({ name: "", type: "shared", memberId: null })).toThrowError(
      new InvalidAccountError("El nombre de la cuenta es obligatorio."),
    );
    expect(() => Account.create({ name: "   ", type: "shared", memberId: null })).toThrowError(
      new InvalidAccountError("El nombre de la cuenta es obligatorio."),
    );
  });

  it("create de cuenta personal exige name null y miembro atribuido", () => {
    const personal = Account.create({ name: null, type: "personal", memberId: MemberId(1) });
    expect(personal.name).toBeNull();
    expect(personal.memberId).toBe(1);

    expect(() =>
      Account.create({ name: "Cuenta de Isma", type: "personal", memberId: MemberId(1) }),
    ).toThrowError(
      new InvalidAccountError(
        "Las cuentas personales no tienen nombre propio: se deriva del miembro.",
      ),
    );
    expect(() => Account.create({ name: null, type: "personal", memberId: null })).toThrowError(
      new InvalidAccountError("Una cuenta personal debe atribuirse a un miembro."),
    );
  });

  it("create de cuenta común rechaza miembro atribuido (regla intacta)", () => {
    expect(() =>
      Account.create({ name: "Cuenta común", type: "shared", memberId: MemberId(1) }),
    ).toThrowError(new InvalidAccountError("La cuenta común no se atribuye a ningún miembro."));
  });

  it("rehydrate acepta name null (personal) y nombre almacenado (común)", () => {
    const personal = Account.rehydrate(1, null, "personal", MemberId(1));
    expect(personal.id).toBe(1);
    expect(personal.name).toBeNull();

    const shared = Account.rehydrate(3, "Cuenta común", "shared", null);
    expect(shared.name).toBe("Cuenta común");
    expect(shared.memberId).toBeNull();
  });

  it("rename en cuenta común devuelve nueva instancia congelada conservando id/type/memberId", () => {
    const shared = Account.rehydrate(3, "Cuenta común", "shared", null);

    const renamed = shared.rename("  Cuenta conjunta  ");

    expect(renamed).not.toBe(shared);
    expect(renamed.id).toBe(3);
    expect(renamed.name).toBe("Cuenta conjunta");
    expect(renamed.type).toBe("shared");
    expect(renamed.memberId).toBeNull();
    expect(Object.isFrozen(renamed)).toBe(true);
    expect(shared.name).toBe("Cuenta común");
  });

  it("rename en cuenta personal lanza AccountNotRenamableError con el literal congelado", () => {
    const personal = Account.rehydrate(1, null, "personal", MemberId(1));
    expect(() => personal.rename("Otro nombre")).toThrowError(
      new AccountNotRenamableError(),
    );
  });

  it('rename("") en cuenta común lanza InvalidAccountError con el literal congelado', () => {
    const shared = Account.rehydrate(3, "Cuenta común", "shared", null);
    expect(() => shared.rename("   ")).toThrowError(
      new InvalidAccountError("El nombre de la cuenta es obligatorio."),
    );
  });
});
