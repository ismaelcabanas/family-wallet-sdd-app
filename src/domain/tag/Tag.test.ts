import { Tag } from "./Tag";
import { TagCategoryId } from "../tag-category/TagCategoryId";
import { InvalidTagError } from "./TagErrors";
import { describe, expect, it } from "vitest";

describe("Tag.rename", () => {
  it("trimea el nombre y conserva id, slug, status y categoryId", () => {
    const tag = Tag.rehydrate(5, "Luz", "luz", "active", TagCategoryId(1));

    const renamed = tag.rename("  Hogar  ");

    expect(renamed.name).toBe("Hogar");
    expect(renamed.id).toBe(5);
    expect(renamed.slug).toBe("luz");
    expect(renamed.status).toBe("active");
    expect(renamed.categoryId).toBe(1);
    expect(tag.name).toBe("Luz");
  });

  it("rechaza nombre vacío o de solo espacios con el literal vigente", () => {
    const tag = Tag.rehydrate(5, "Luz", "luz", "active", TagCategoryId(1));

    expect(() => tag.rename("")).toThrowError(InvalidTagError);
    expect(() => tag.rename("   ")).toThrowError(
      new InvalidTagError("El nombre de la etiqueta es obligatorio."),
    );
  });

  it("conserva el estado distinto de active en la instancia devuelta", () => {
    const tag = Tag.rehydrate(5, "Luz", "luz", "inactive", TagCategoryId(1));

    const renamed = tag.rename("Hogar");

    expect(renamed.status).toBe("inactive");
    expect(renamed.slug).toBe("luz");
    expect(renamed.categoryId).toBe(1);
  });
});

describe("Tag.withStatus", () => {
  it("devuelve una nueva instancia con el estado dado y el resto de campos intactos", () => {
    const tag = Tag.rehydrate(5, "Luz", "luz", "active", TagCategoryId(1));

    const deactivated = tag.withStatus("inactive");

    expect(deactivated.name).toBe("Luz");
    expect(deactivated.id).toBe(5);
    expect(deactivated.slug).toBe("luz");
    expect(deactivated.status).toBe("inactive");
    expect(deactivated.categoryId).toBe(1);
    expect(tag.status).toBe("active");
  });

  it("reactivar devuelve una instancia con status active", () => {
    const tag = Tag.rehydrate(5, "Luz", "luz", "inactive", TagCategoryId(1));

    const reactivated = tag.withStatus("active");

    expect(reactivated.status).toBe("active");
    expect(tag.status).toBe("inactive");
  });
});

describe("Tag (pertenencia a categoría, FR-001)", () => {
  it("create exige categoryId: toda etiqueta nace con categoría", () => {
    const tag = Tag.create({ name: "Mascotas", slug: "mascotas", status: "active", categoryId: TagCategoryId(2) });

    expect(tag.id).toBeNull();
    expect(tag.categoryId).toBe(2);
  });

  it("rehydrate materializa el categoryId persistido", () => {
    const tag = Tag.rehydrate(7, "Ocio", "ocio", "active", TagCategoryId(3));

    expect(tag.categoryId).toBe(3);
  });

  it("TagCategoryId rechaza valores no positivos (brand espejo de TagId)", () => {
    expect(() => TagCategoryId(0)).toThrowError(RangeError);
    expect(() => TagCategoryId(-1)).toThrowError(RangeError);
    expect(() => TagCategoryId(1.5)).toThrowError(RangeError);
  });

  it("moveToCategory devuelve una nueva instancia con solo la categoría cambiada", () => {
    const tag = Tag.rehydrate(7, "Ocio", "ocio", "active", TagCategoryId(1));

    const moved = tag.moveToCategory(TagCategoryId(4));

    expect(moved.categoryId).toBe(4);
    expect(moved.id).toBe(7);
    expect(moved.name).toBe("Ocio");
    expect(moved.slug).toBe("ocio");
    expect(moved.status).toBe("active");
    expect(tag.categoryId).toBe(1);
  });
});
