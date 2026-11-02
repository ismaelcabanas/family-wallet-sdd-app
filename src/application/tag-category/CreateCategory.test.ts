import { TagCategory } from "@/domain/tag-category/TagCategory";
import {
  DuplicateCategoryNameError,
  InvalidCategoryError,
} from "@/domain/tag-category/TagCategoryErrors";
import { beforeEach, describe, expect, it } from "vitest";

import { CreateCategory } from "./CreateCategory";
import { InMemoryCategoryRepository } from "./InMemoryCategoryRepository";

describe("CreateCategory", () => {
  let repository: InMemoryCategoryRepository;
  let useCase: CreateCategory;

  beforeEach(() => {
    repository = new InMemoryCategoryRepository([
      TagCategory.rehydrate(1, "General", "general"),
      TagCategory.rehydrate(2, "Hogar", "hogar"),
    ]);
    useCase = new CreateCategory(repository);
  });

  it("crea una categoría con nombre trimeado y slug derivado", async () => {
    const category = await useCase.execute({ name: "  Alimentación  " });

    expect(category.id).toBe(100);
    expect(category.name).toBe("Alimentación");
    expect(category.slug).toBe("alimentacion");
    expect(repository.stored).toHaveLength(3);
  });

  it("rechaza nombre vacío o de solo espacios con el mensaje congelado", async () => {
    await expect(useCase.execute({ name: "" })).rejects.toThrowError(InvalidCategoryError);
    await expect(useCase.execute({ name: "   " })).rejects.toThrowError(
      "El nombre de la categoría es obligatorio.",
    );
  });

  it("rechaza duplicado case-insensitive («Hogar» vs «HOGAR») con el nombre canónico", async () => {
    await expect(useCase.execute({ name: "HOGAR" })).rejects.toThrowError(
      new DuplicateCategoryNameError("Hogar"),
    );
    await expect(useCase.execute({ name: "hogar" })).rejects.toThrowError(DuplicateCategoryNameError);
  });

  it("«Alimentación» vs «Alimentacion» NO son duplicados (sin normalizar acentos)", async () => {
    const category = await useCase.execute({ name: "Alimentación" });

    expect(category.name).toBe("Alimentación");
    expect(repository.stored).toHaveLength(3);
  });

  it("resuelve colisión de slug con sufijo -2 (Hogar ya existe → hogar-2)", async () => {
    const category = await useCase.execute({ name: "¡Hogar!" });

    expect(category.slug).toBe("hogar-2");
  });

  it("puede llamarse igual que una etiqueta (la unicidad aplica solo entre categorías)", async () => {
    const category = await useCase.execute({ name: "Supermercado" });

    expect(category.name).toBe("Supermercado");
  });
});
