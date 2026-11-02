import { TagCategory } from "@/domain/tag-category/TagCategory";
import { TagCategoryId } from "@/domain/tag-category/TagCategoryId";
import {
  CategoryNotFoundError,
  DuplicateCategoryNameError,
} from "@/domain/tag-category/TagCategoryErrors";
import { beforeEach, describe, expect, it } from "vitest";

import { InMemoryCategoryRepository } from "./InMemoryCategoryRepository";
import { RenameCategory } from "./RenameCategory";

describe("RenameCategory", () => {
  let repository: InMemoryCategoryRepository;
  let useCase: RenameCategory;

  beforeEach(() => {
    repository = new InMemoryCategoryRepository([
      TagCategory.rehydrate(1, "General", "general"),
      TagCategory.rehydrate(2, "Hogar", "hogar"),
      TagCategory.rehydrate(3, "Viajes", "viajes"),
    ]);
    useCase = new RenameCategory(repository);
  });

  it("renombra con trim y conserva id y slug", async () => {
    const renamed = await useCase.execute({ categoryId: TagCategoryId(2), name: "  Casa  " });

    expect(renamed.id).toBe(2);
    expect(renamed.name).toBe("Casa");
    expect(renamed.slug).toBe("hogar");
  });

  it("id inexistente lanza CategoryNotFoundError", async () => {
    await expect(useCase.execute({ categoryId: TagCategoryId(99), name: "Casa" })).rejects.toThrowError(
      CategoryNotFoundError,
    );
  });

  it("rechaza duplicado case-insensitive con otra categoría mostrando el nombre canónico", async () => {
    await expect(
      useCase.execute({ categoryId: TagCategoryId(2), name: "VIAJES" }),
    ).rejects.toThrowError(new DuplicateCategoryNameError("Viajes"));
  });

  it("el renombrado se autoexcluye («luz» → «Luz» permitido)", async () => {
    const renamed = await useCase.execute({ categoryId: TagCategoryId(2), name: "HOGAR" });

    expect(renamed.name).toBe("HOGAR");
    expect(renamed.id).toBe(2);
  });

  it("la genérica es renombrable sin perder su slug", async () => {
    const renamed = await useCase.execute({ categoryId: TagCategoryId(1), name: "Varias" });

    expect(renamed.id).toBe(1);
    expect(renamed.slug).toBe("general");
  });
});
