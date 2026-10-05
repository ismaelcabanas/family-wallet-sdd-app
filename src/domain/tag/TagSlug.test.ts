import { describe, expect, it } from "vitest";

import { deriveTagSlug } from "./TagSlug";

describe("deriveTagSlug", () => {
  it("reproduce los slugs del catálogo del seed (convención manual hecha función)", () => {
    const seedCases: Array<[name: string, slug: string]> = [
      ["Hogar", "hogar"],
      ["Coche", "coche"],
      ["Salud", "salud"],
      ["Alimentación", "alimentacion"],
      ["Ocio", "ocio"],
      ["Viaje", "viaje"],
      ["Ropa", "ropa"],
      ["Regalos", "regalos"],
      ["Suscripciones online", "suscripciones-online"],
      ["Sin Clasificar", "sin-clasificar"],
      ["Vivienda", "vivienda"],
      ["Hipoteca", "hipoteca"],
    ];

    for (const [name, slug] of seedCases) {
      expect(deriveTagSlug(name)).toBe(slug);
    }
  });

  it("normaliza acentos vía NFD y minúsculas", () => {
    expect(deriveTagSlug("Café y té")).toBe("cafe-y-te");
    expect(deriveTagSlug("Alimentación")).toBe("alimentacion");
    expect(deriveTagSlug("Versión Próxima")).toBe("version-proxima");
  });

  it("recorta espacios y respeta mayúsculas → minúsculas", () => {
    expect(deriveTagSlug("  Mascotas  ")).toBe("mascotas");
    expect(deriveTagSlug("LUZ")).toBe("luz");
  });

  it("sustituye cada carácter no alfanumérico por guion y colapsa runs", () => {
    expect(deriveTagSlug("a  b")).toBe("a-b");
    expect(deriveTagSlug("a — b")).toBe("a-b");
    expect(deriveTagSlug("Suscripciones online")).toBe("suscripciones-online");
  });

  it("recorta guiones de borde", () => {
    expect(deriveTagSlug("-Mascotas-")).toBe("mascotas");
    expect(deriveTagSlug("Mascotas —")).toBe("mascotas");
  });

  it("conserva caracteres alfanuméricos Unicode", () => {
    expect(deriveTagSlug("Ñandú 12")).toBe("nandu-12");
  });

  it("puede devolver cadena vacía cuando no queda nada (solo símbolos)", () => {
    expect(deriveTagSlug("---")).toBe("");
    expect(deriveTagSlug("   ")).toBe("");
    expect(deriveTagSlug("—·—")).toBe("");
  });
});
