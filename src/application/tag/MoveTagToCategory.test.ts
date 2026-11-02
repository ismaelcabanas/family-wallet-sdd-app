import { Tag } from "@/domain/tag/Tag";
import { TagId } from "@/domain/tag/TagId";
import { TagNotFoundError } from "@/domain/tag/TagErrors";
import { TagCategory } from "@/domain/tag-category/TagCategory";
import { TagCategoryId } from "@/domain/tag-category/TagCategoryId";
import { CategoryNotFoundError } from "@/domain/tag-category/TagCategoryErrors";
import { beforeEach, describe, expect, it } from "vitest";

import { InMemoryCategoryRepository } from "@/application/tag-category/InMemoryCategoryRepository";
import { InMemoryCatalogTagRepository } from "./InMemoryCatalogTagRepository";
import { MoveTagToCategory } from "./MoveTagToCategory";

describe("MoveTagToCategory", () => {
  let tags: InMemoryCatalogTagRepository;
  let categories: InMemoryCategoryRepository;
  let useCase: MoveTagToCategory;

  beforeEach(() => {
    tags = new InMemoryCatalogTagRepository([
      Tag.rehydrate(1, "Supermercado", "supermercado", "active", TagCategoryId(1)),
      Tag.rehydrate(100, "Aportación Común", "aportacion-comun", "active", TagCategoryId(1)),
    ]);
    categories = new InMemoryCategoryRepository([
      TagCategory.rehydrate(1, "General", "general"),
      TagCategory.rehydrate(2, "Alimentación", "alimentacion"),
    ]);
    useCase = new MoveTagToCategory(tags, categories);
  });

  it("mueve una etiqueta a otra categoría actualizando su pertenencia", async () => {
    const result = await useCase.execute({ tagId: TagId(1), categoryId: TagCategoryId(2) });

    expect(result.tag.categoryId).toBe(2);
    expect(result.category.name).toBe("Alimentación");
    expect(tags.updated).toHaveLength(1);
    expect(tags.stored.find((tag) => tag.id === 1)?.categoryId).toBe(2);
  });

  it("mover a la misma categoría es un no-op con éxito sin escritura", async () => {
    const result = await useCase.execute({ tagId: TagId(1), categoryId: TagCategoryId(1) });

    expect(result.tag.categoryId).toBe(1);
    expect(result.category.slug).toBe("general");
    expect(tags.updated).toHaveLength(0);
  });

  it("etiqueta inexistente lanza TagNotFoundError", async () => {
    await expect(useCase.execute({ tagId: TagId(42), categoryId: TagCategoryId(2) })).rejects.toThrowError(
      TagNotFoundError,
    );
  });

  it("categoría inexistente lanza CategoryNotFoundError", async () => {
    await expect(useCase.execute({ tagId: TagId(1), categoryId: TagCategoryId(42) })).rejects.toThrowError(
      CategoryNotFoundError,
    );
  });

  it("«Aportación Común» es movible como cualquier etiqueta (sin protección extra)", async () => {
    const result = await useCase.execute({ tagId: TagId(100), categoryId: TagCategoryId(2) });

    expect(result.tag.id).toBe(100);
    expect(result.tag.categoryId).toBe(2);
  });
});
