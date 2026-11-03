import { Tag } from "@/domain/tag/Tag";
import { TagCategory } from "@/domain/tag-category/TagCategory";
import { TagCategoryId } from "@/domain/tag-category/TagCategoryId";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { InMemoryCategoryRepository } from "@/application/tag-category/InMemoryCategoryRepository";
import { ListGroupedActiveTags } from "./ListGroupedActiveTags";
import { InMemoryCatalogTagRepository } from "./InMemoryCatalogTagRepository";

describe("ListGroupedActiveTags", () => {
  let repository: InMemoryCatalogTagRepository;
  let categories: InMemoryCategoryRepository;
  let useCase: ListGroupedActiveTags;

  beforeEach(() => {
    repository = new InMemoryCatalogTagRepository([
      Tag.rehydrate(2, "Luz", "luz", "active", TagCategoryId(1)),
      Tag.rehydrate(1, "Alimentación", "alimentacion", "active", TagCategoryId(1)),
      Tag.rehydrate(3, "Sin Clasificar", "sin-clasificar", "active", TagCategoryId(1)),
      Tag.rehydrate(4, "Hotel", "hotel", "active", TagCategoryId(2)),
      Tag.rehydrate(5, "Cine", "cine", "active", TagCategoryId(3)),
      Tag.rehydrate(6, "Teatro", "teatro", "inactive", TagCategoryId(3)),
      Tag.rehydrate(7, "Netflix", "netflix", "inactive", TagCategoryId(4)),
    ]);
    categories = new InMemoryCategoryRepository([
      TagCategory.rehydrate(1, "General", "general"),
      TagCategory.rehydrate(2, "Viajes", "viajes"),
      TagCategory.rehydrate(3, "Ocio", "ocio"),
      TagCategory.rehydrate(4, "Suscripciones", "suscripciones"),
    ]);
    useCase = new ListGroupedActiveTags(repository, categories);
  });

  it("agrupa por categoría sin perder ninguna etiqueta activa", async () => {
    const groups = await useCase.execute();

    const allTags = groups.flatMap((group) => group.tags);
    expect(allTags).toHaveLength(5);
    expect(groups.flatMap((group) => group.tags.map((tag) => tag.id)).sort()).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });

  it("lee categorías y etiquetas en lecturas paralelas (patrón ListTagCatalog)", async () => {
    const findAll = vi.spyOn(categories, "findAll");
    const findAllActive = vi.spyOn(repository, "findAllActive");

    await useCase.execute();

    expect(findAll).toHaveBeenCalledExactlyOnceWith();
    expect(findAllActive).toHaveBeenCalledExactlyOnceWith();
  });

  it("la genérica va primera y el resto por nombre es-ES", async () => {
    const groups = await useCase.execute();

    expect(groups.map((group) => group.category.name)).toEqual(["General", "Ocio", "Viajes"]);
    expect(groups[0].category).toEqual({ id: 1, name: "General", isDefault: true });
    expect(groups[1].category.isDefault).toBe(false);
  });

  it("omite categorías sin etiquetas activas (nunca cabecera vacía — esc. 8)", async () => {
    const groups = await useCase.execute();

    expect(groups.map((group) => group.category.id)).not.toContain(4);
    expect(groups.some((group) => group.category.name === "Suscripciones")).toBe(false);
  });

  it("solo incluye etiquetas activas", async () => {
    const groups = await useCase.execute();

    const names = groups.flatMap((group) => group.tags.map((tag) => tag.name));
    expect(names).not.toContain("Teatro");
    expect(names).not.toContain("Netflix");
  });

  it("dentro de cada grupo las etiquetas van por nombre (criterio de ListActiveTags)", async () => {
    const groups = await useCase.execute();

    expect(groups[0].tags.map((tag) => tag.name)).toEqual([
      "Alimentación",
      "Luz",
      "Sin Clasificar",
    ]);
  });

  it("cada etiqueta viaja con su categoryId y el categoryName del grupo", async () => {
    const groups = await useCase.execute();

    const general = groups[0];
    expect(general.tags.every((tag) => tag.categoryId === 1 && tag.categoryName === "General")).toBe(
      true,
    );
    const ocio = groups[1];
    expect(ocio.tags[0]).toEqual({
      id: 5,
      name: "Cine",
      slug: "cine",
      categoryId: 3,
      categoryName: "Ocio",
    });
  });
});
