import type { Tag } from "@/domain/tag/Tag";
import type { TagId } from "@/domain/tag/TagId";
import { TagNotFoundError } from "@/domain/tag/TagErrors";
import type { TagCategory } from "@/domain/tag-category/TagCategory";
import type { TagCategoryId } from "@/domain/tag-category/TagCategoryId";
import { CategoryNotFoundError } from "@/domain/tag-category/TagCategoryErrors";
import type { CategoryRepository } from "@/application/tag-category/CategoryRepository";

import type { TagRepository } from "./TagRepository";

export class MoveTagToCategory {
  constructor(
    private readonly tags: TagRepository,
    private readonly categories: CategoryRepository,
  ) {}

  async execute(input: {
    tagId: TagId;
    categoryId: TagCategoryId;
  }): Promise<{ tag: Tag; category: TagCategory }> {
    const tag = await this.tags.findById(input.tagId);
    if (tag === null) {
      throw new TagNotFoundError();
    }

    const category = await this.categories.findById(input.categoryId);
    if (category === null) {
      throw new CategoryNotFoundError();
    }

    if (tag.categoryId === input.categoryId) {
      return { tag, category };
    }

    return { tag: await this.tags.update(tag.moveToCategory(input.categoryId)), category };
  }
}
