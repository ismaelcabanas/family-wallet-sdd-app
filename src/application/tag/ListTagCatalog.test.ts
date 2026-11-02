import { Tag } from "@/domain/tag/Tag";
import { TagCategory } from "@/domain/tag-category/TagCategory";
import { TagCategoryId } from "@/domain/tag-category/TagCategoryId";
import { beforeEach, describe, expect, it } from "vitest";

import { InMemoryCategoryRepository } from "@/application/tag-category/InMemoryCategoryRepository";
import { InMemoryCatalogTagRepository } from "./InMemoryCatalogTagRepository";
import { ListTagCatalog } from "./ListTagCatalog";

describe("ListTagCatalog", () => {
  let tags: InMemoryCatalogTagRepository;
  let categories: InMemoryCategoryRepository;
  let useCase: ListTagCatalog;

  beforeEach(() => {
    categories = new InMemoryCategoryRepository([
      TagCategory.rehydrate(3, "Viajes", "viajes"),
      TagCategory.rehydrate(1, "General", "general"),
      TagCategory.rehydrate(2, "Alimentación", "alimentacion"),
    ]);
    tags = new InMemoryCatalogTagRepository([
      Tag.rehydrate(100, "Aportación Común", "aportacion-comun", "active", TagCategoryId(1)),
      Tag.rehydrate(1, "Ocio", "ocio", "active", TagCategoryId(1)),
      Tag.rehydrate(2, "Supermercado", "supermercado", "active", TagCategoryId(2)),
      Tag.rehydrate(3, "Zapatos", "zapatos", "inactive", TagCategoryId(2)),
      Tag.rehydrate(4, "Apagada", "apagada", "inactive", TagCategoryId(1)),
      Tag.rehydrate(5, "Vuelos", "vuelos", "active", TagCategoryId(3)),
    ]);
    useCase = new ListTagCatalog(tags, categories);
  });

  it("agrupa cada etiqueta bajo su categoría sin perder ninguna", async () => {
    const groups = await useCase.execute();

    const allTags = groups.flatMap((group) => group.tags);
    expect(allTags).toHaveLength(6);
    for (const tag of tags.stored) {
      expect(allTags.some((dto) => dto.id === tag.id)).toBe(true);
    }
    const supermercado = groups
      .find((group) => group.category.id === 2)
      ?.tags.find((dto) => dto.id === 2);
    expect(supermercado?.name).toBe("Supermercado");
  });

  it("la genérica va primero y el resto ordenadas por nombre (es)", async () => {
    const groups = await useCase.execute();

    expect(groups.map((group) => group.category.name)).toEqual([
      "General",
      "Alimentación",
      "Viajes",
    ]);
  });

  it("dentro de cada grupo: activas primero y luego nombre", async () => {
    const groups = await useCase.execute();

    const general = groups[0]?.tags ?? [];
    expect(general.map((dto) => dto.name)).toEqual(["Aportación Común", "Ocio", "Apagada"]);
    const alimentacion = groups[1]?.tags ?? [];
    expect(alimentacion.map((dto) => dto.name)).toEqual(["Supermercado", "Zapatos"]);
  });

  it("las categorías vacías aparecen como grupo con lista de etiquetas vacía", async () => {
    categories = new InMemoryCategoryRepository([
      TagCategory.rehydrate(1, "General", "general"),
      TagCategory.rehydrate(2, "Alimentación", "alimentacion"),
    ]);
    tags = new InMemoryCatalogTagRepository([
      Tag.rehydrate(1, "Ocio", "ocio", "active", TagCategoryId(1)),
    ]);
    useCase = new ListTagCatalog(tags, categories);

    const groups = await useCase.execute();

    expect(groups).toHaveLength(2);
    expect(groups[1]?.tags).toEqual([]);
  });

  it("CategoryDTO marca isDefault solo para el slug genérico", async () => {
    const groups = await useCase.execute();

    expect(groups[0]?.category).toEqual({ id: 1, name: "General", isDefault: true });
    expect(groups[1]?.category).toEqual({ id: 2, name: "Alimentación", isDefault: false });
  });

  it("isProtected solo para el slug de sistema (paridad ListTags)", async () => {
    const groups = await useCase.execute();

    const allTags = groups.flatMap((group) => group.tags);
    const contribution = allTags.find((dto) => dto.id === 100);
    expect(contribution?.isProtected).toBe(true);
    expect(allTags.filter((dto) => dto.isProtected)).toHaveLength(1);
  });
});
