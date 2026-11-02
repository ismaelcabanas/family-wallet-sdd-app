import { TagCategory } from "@/domain/tag-category/TagCategory";
import { TagCategoryId } from "@/domain/tag-category/TagCategoryId";
import {
  CategoryNotFoundError,
  CategoryNotEmptyError,
  ProtectedCategoryError,
} from "@/domain/tag-category/TagCategoryErrors";
import { beforeEach, describe, expect, it } from "vitest";

import { DeleteCategory } from "./DeleteCategory";
import { InMemoryCategoryRepository } from "./InMemoryCategoryRepository";

describe("DeleteCategory", () => {
  let repository: InMemoryCategoryRepository;
  let useCase: DeleteCategory;

  beforeEach(() => {
    repository = new InMemoryCategoryRepository([
      TagCategory.rehydrate(1, "General", "general"),
      TagCategory.rehydrate(2, "Viajes", "viajes"),
    ]);
    useCase = new DeleteCategory(repository);
  });

  it("elimina una categoría vacía", async () => {
    await useCase.execute({ categoryId: TagCategoryId(2) });

    expect(repository.stored.map((category) => category.id)).toEqual([1]);
    expect(repository.deleted).toEqual([2]);
  });

  it("id inexistente lanza CategoryNotFoundError", async () => {
    await expect(useCase.execute({ categoryId: TagCategoryId(99) })).rejects.toThrowError(CategoryNotFoundError);
  });

  it("la genérica (slug «general») no es eliminable: ProtectedCategoryError", async () => {
    await expect(useCase.execute({ categoryId: TagCategoryId(1) })).rejects.toThrowError(
      new ProtectedCategoryError("General"),
    );
    expect(repository.deleted).toEqual([]);
  });

  it("la genérica renombrada sigue protegida (identidad por slug, no por nombre)", async () => {
    repository.stored = [
      TagCategory.rehydrate(1, "Varias", "general"),
      TagCategory.rehydrate(2, "Viajes", "viajes"),
    ];

    await expect(useCase.execute({ categoryId: TagCategoryId(1) })).rejects.toThrowError(ProtectedCategoryError);
  });

  it("categoría con etiquetas asignadas lanza CategoryNotEmptyError", async () => {
    repository.countTagsOverride.set(2, 3);

    await expect(useCase.execute({ categoryId: TagCategoryId(2) })).rejects.toThrowError(
      new CategoryNotEmptyError("Viajes"),
    );
    expect(repository.deleted).toEqual([]);
  });
});
