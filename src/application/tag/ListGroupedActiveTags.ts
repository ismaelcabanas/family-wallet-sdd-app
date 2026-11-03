import { isDefaultCategorySlug } from "@/domain/tag-category/DefaultCategory";
import type { CategoryRepository } from "@/application/tag-category/CategoryRepository";

import type { TagDTO } from "../movement/dto";
import type { ActiveTagGroupDTO } from "./dto";
import type { TagRepository } from "./TagRepository";

export class ListGroupedActiveTags {
  constructor(
    private readonly tags: TagRepository,
    private readonly categories: CategoryRepository,
  ) {}

  async execute(): Promise<ActiveTagGroupDTO[]> {
    const [allCategories, activeTags] = await Promise.all([
      this.categories.findAll(),
      this.tags.findAllActive(),
    ]);

    const groupByCategoryId = new Map<number, ActiveTagGroupDTO>();
    for (const category of allCategories) {
      if (category.id === null) continue;
      groupByCategoryId.set(category.id, {
        category: {
          id: category.id,
          name: category.name,
          isDefault: isDefaultCategorySlug(category.slug),
        },
        tags: [] as TagDTO[],
      });
    }

    for (const tag of activeTags) {
      if (tag.id === null) continue;
      const group = groupByCategoryId.get(tag.categoryId as number);
      if (group === undefined) continue;
      group.tags.push({
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        categoryId: group.category.id,
        categoryName: group.category.name,
      });
    }

    const groups = [...groupByCategoryId.values()].filter((group) => group.tags.length > 0);

    for (const group of groups) {
      group.tags.sort((a, b) => a.name.localeCompare(b.name, "es"));
    }

    return groups.sort((a, b) => {
      if (a.category.isDefault !== b.category.isDefault) {
        return a.category.isDefault ? -1 : 1;
      }
      return a.category.name.localeCompare(b.category.name, "es");
    });
  }
}
