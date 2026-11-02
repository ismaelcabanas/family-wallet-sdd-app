import { describe, expect, it } from "vitest";

import { InvalidCategoryError } from "./TagCategoryErrors";
import { TagCategory } from "./TagCategory";

describe("TagCategory.create", () => {
  it("trimea el nombre y crea una categoría sin id", () => {
    const category = TagCategory.create({ name: "  Alimentación  ", slug: "alimentacion" });

    expect(category.id).toBeNull();
    expect(category.name).toBe("Alimentación");
    expect(category.slug).toBe("alimentacion");
  });

  it("rechaza nombre vacío tras trim con InvalidCategoryError", () => {
    expect(() => TagCategory.create({ name: "", slug: "x" })).toThrowError(InvalidCategoryError);
    expect(() => TagCategory.create({ name: "   ", slug: "x" })).toThrowError(
      new InvalidCategoryError("El nombre de la categoría es obligatorio."),
    );
  });

  it("rechaza slug vacío tras trim", () => {
    expect(() => TagCategory.create({ name: "Hogar", slug: "" })).toThrowError(
      InvalidCategoryError,
    );
    expect(() => TagCategory.create({ name: "Hogar", slug: "   " })).toThrowError(
      InvalidCategoryError,
    );
  });
});

describe("TagCategory.rehydrate", () => {
  it("fija el id y conserva name y slug", () => {
    const category = TagCategory.rehydrate(3, "Hogar", "hogar");

    expect(category.id).toBe(3);
    expect(category.name).toBe("Hogar");
    expect(category.slug).toBe("hogar");
  });
});

describe("TagCategory.rename", () => {
  it("conserva id y slug (inmutable) y trimea el nuevo nombre", () => {
    const category = TagCategory.rehydrate(3, "Hogar", "hogar");

    const renamed = category.rename("  Viajes  ");

    expect(renamed.id).toBe(3);
    expect(renamed.slug).toBe("hogar");
    expect(renamed.name).toBe("Viajes");
    expect(category.name).toBe("Hogar");
  });

  it("rechaza nombre vacío tras trim", () => {
    const category = TagCategory.rehydrate(3, "Hogar", "hogar");

    expect(() => category.rename("   ")).toThrowError(InvalidCategoryError);
  });
});
