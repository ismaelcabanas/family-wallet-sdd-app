import { Tag } from "./Tag";
import { InvalidTagError } from "./TagErrors";
import { describe, expect, it } from "vitest";

describe("Tag.rename", () => {
  it("trimea el nombre y conserva id, slug y status", () => {
    const tag = Tag.rehydrate(5, "Luz", "luz", "active");

    const renamed = tag.rename("  Hogar  ");

    expect(renamed.name).toBe("Hogar");
    expect(renamed.id).toBe(5);
    expect(renamed.slug).toBe("luz");
    expect(renamed.status).toBe("active");
    expect(tag.name).toBe("Luz");
  });

  it("rechaza nombre vacío o de solo espacios con el literal vigente", () => {
    const tag = Tag.rehydrate(5, "Luz", "luz", "active");

    expect(() => tag.rename("")).toThrowError(InvalidTagError);
    expect(() => tag.rename("   ")).toThrowError(
      new InvalidTagError("El nombre de la etiqueta es obligatorio."),
    );
  });

  it("conserva el estado distinto de active en la instancia devuelta", () => {
    const tag = Tag.rehydrate(5, "Luz", "luz", "inactive");

    const renamed = tag.rename("Hogar");

    expect(renamed.status).toBe("inactive");
    expect(renamed.slug).toBe("luz");
  });
});

describe("Tag.withStatus", () => {
  it("devuelve una nueva instancia con el estado dado y el resto de campos intactos", () => {
    const tag = Tag.rehydrate(5, "Luz", "luz", "active");

    const deactivated = tag.withStatus("inactive");

    expect(deactivated.name).toBe("Luz");
    expect(deactivated.id).toBe(5);
    expect(deactivated.slug).toBe("luz");
    expect(deactivated.status).toBe("inactive");
    expect(tag.status).toBe("active");
  });

  it("reactivar devuelve una instancia con status active", () => {
    const tag = Tag.rehydrate(5, "Luz", "luz", "inactive");

    const reactivated = tag.withStatus("active");

    expect(reactivated.status).toBe("active");
    expect(tag.status).toBe("inactive");
  });
});
