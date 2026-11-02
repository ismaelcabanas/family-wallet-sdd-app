import { isProtectedTagSlug } from "@/domain/tag/SystemTags";
import { isDefaultCategorySlug } from "@/domain/tag-category/DefaultCategory";
import type { CategoryRepository } from "@/application/tag-category/CategoryRepository";

import type { CatalogTagDTO, TagCatalogGroupDTO } from "./dto";
import type { TagRepository } from "./TagRepository";

export class ListTagCatalog {
  constructor(
    private readonly tags: TagRepository,
    private readonly categories: CategoryRepository,
  ) {}

  async execute(): Promise<TagCatalogGroupDTO[]> {
    const [allCategories, allTags] = await Promise.all([
      this.categories.findAll(),
      this.tags.findAll(),
    ]);

    const groups = allCategories.flatMap((category) =>
      category.id === null
        ? []
        : [
            {
              category: {
                id: category.id,
                name: category.name,
                isDefault: isDefaultCategorySlug(category.slug),
              },
              tags: [] as CatalogTagDTO[],
            },
          ],
    );
    const groupByCategoryId = new Map<number, TagCatalogGroupDTO>(
      groups.map((group) => [group.category.id, group] as const),
    );

    for (const tag of allTags) {
      if (tag.id === null) continue;
      const group = groupByCategoryId.get(tag.categoryId as number);
      if (group === undefined) continue;
      group.tags.push({
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        status: tag.status,
        isProtected: isProtectedTagSlug(tag.slug),
      });
    }

    for (const group of groups) {
      group.tags.sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === "active" ? -1 : 1;
        }
        return a.name.localeCompare(b.name, "es");
      });
    }

    return groups.sort((a, b) => {
      if (a.category.isDefault !== b.category.isDefault) {
        return a.category.isDefault ? -1 : 1;
      }
      return a.category.name.localeCompare(b.category.name, "es");
    });
  }
}
