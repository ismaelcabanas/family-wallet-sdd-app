import { personalAccountDisplayName } from "./display-name";
import { describe, expect, it } from "vitest";

describe("personalAccountDisplayName", () => {
  it("compone «Cuenta de {miembro}» con el nombre recibido", () => {
    expect(personalAccountDisplayName("Isma")).toBe("Cuenta de Isma");
    expect(personalAccountDisplayName("Miembro A")).toBe("Cuenta de Miembro A");
  });

  it('con cadena vacía compone «Cuenta de » (función pura sin validación)', () => {
    expect(personalAccountDisplayName("")).toBe("Cuenta de ");
  });

  it("con null usa el fallback «miembro» (paridad con notas/etiquetas)", () => {
    expect(personalAccountDisplayName(null)).toBe("Cuenta de miembro");
  });
});
