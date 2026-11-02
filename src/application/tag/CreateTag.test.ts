import { Tag } from "@/domain/tag/Tag";
import { TagCategory } from "@/domain/tag-category/TagCategory";
import { TagCategoryId } from "@/domain/tag-category/TagCategoryId";
import { CategoryNotFoundError } from "@/domain/tag-category/TagCategoryErrors";
import { DuplicateTagNameError, InvalidTagError } from "@/domain/tag/TagErrors";
import { beforeEach, describe, expect, it } from "vitest";

import { InMemoryCategoryRepository } from "@/application/tag-category/InMemoryCategoryRepository";
import { CreateTag } from "./CreateTag";
import { InMemoryCatalogTagRepository } from "./InMemoryCatalogTagRepository";

describe("CreateTag", () => {
  let repository: InMemoryCatalogTagRepository;
  let categories: InMemoryCategoryRepository;
  let useCase: CreateTag;

  beforeEach(() => {
    repository = new InMemoryCatalogTagRepository([
      Tag.rehydrate(1, "Luz", "luz", "active", TagCategoryId(1)),
      Tag.rehydrate(2, "Inactiva", "inactiva", "inactive", TagCategoryId(1)),
      Tag.rehydrate(3, "Alimentacion", "alimentacion", "active", TagCategoryId(1)),
      Tag.rehydrate(9, "Sin Clasificar", "sin-clasificar", "active", TagCategoryId(1)),
    ]);
    categories = new InMemoryCategoryRepository([
      TagCategory.rehydrate(1, "General", "general"),
      TagCategory.rehydrate(2, "Viajes", "viajes"),
    ]);
    useCase = new CreateTag(repository, categories);
  });

  it("crea una etiqueta activa con nombre trimeado y slug derivado", async () => {
    const tag = await useCase.execute({ name: "  Mascotas  " });

    expect(tag.id).toBe(100);
    expect(tag.name).toBe("Mascotas");
    expect(tag.slug).toBe("mascotas");
    expect(tag.status).toBe("active");
    expect(repository.stored).toHaveLength(5);
  });

  it("toda etiqueta nueva nace en la categoría genérica (FR-007)", async () => {
    const tag = await useCase.execute({ name: "Mascotas" });

    expect(tag.categoryId).toBe(1);
  });

  it("la genérica ausente rompe el invariante: CategoryNotFoundError", async () => {
    categories.stored = [TagCategory.rehydrate(2, "Viajes", "viajes")];

    await expect(useCase.execute({ name: "Mascotas" })).rejects.toThrowError(
      CategoryNotFoundError,
    );
  });

  it("rechaza nombre vacío o de solo espacios", async () => {
    await expect(useCase.execute({ name: "" })).rejects.toThrowError(InvalidTagError);
    await expect(useCase.execute({ name: "   " })).rejects.toThrowError(InvalidTagError);
    await expect(useCase.execute({ name: "" })).rejects.toThrowError(
      "El nombre de la etiqueta es obligatorio.",
    );
  });

  it("rechaza duplicado exacto y case-insensitive (LUZ vs Luz)", async () => {
    await expect(useCase.execute({ name: "Luz" })).rejects.toThrowError(DuplicateTagNameError);
    await expect(useCase.execute({ name: "LUZ" })).rejects.toThrowError(
      new DuplicateTagNameError("LUZ"),
    );
  });

  it("rechaza duplicado de una etiqueta inactiva (la unicidad ignora estado)", async () => {
    await expect(useCase.execute({ name: "inactiva" })).rejects.toThrowError(
      new DuplicateTagNameError("inactiva"),
    );
  });

  it("resuelve colisión de slug con sufijo -2 (Alimentación vs Alimentacion)", async () => {
    const tag = await useCase.execute({ name: "Alimentación" });

    expect(tag.slug).toBe("alimentacion-2");
    expect(tag.name).toBe("Alimentación");
  });

  it("encadena sufijos -2, -3, … hasta encontrar hueco", async () => {
    await useCase.execute({ name: "Alimentación" });

    const tag = await useCase.execute({ name: "Alimentación-" });

    expect(tag.slug).toBe("alimentacion-3");
  });

  it("rechaza nombres de solo símbolos (slug derivado vacío → InvalidTagError)", async () => {
    await expect(useCase.execute({ name: "---" })).rejects.toThrowError(InvalidTagError);
  });
});
