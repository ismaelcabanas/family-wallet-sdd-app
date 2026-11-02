import type { TagCategory } from "@/domain/tag-category/TagCategory";
import type { TagCategoryId } from "@/domain/tag-category/TagCategoryId";
import {
  CategoryNotFoundError,
  DuplicateCategoryNameError,
} from "@/domain/tag-category/TagCategoryErrors";

import type { CategoryRepository } from "./CategoryRepository";

export class RenameCategory {
  constructor(private readonly categories: CategoryRepository) {}

  async execute(input: { categoryId: TagCategoryId; name: string }): Promise<TagCategory> {
    const category = await this.categories.findById(input.categoryId);
    if (category === null) {
      throw new CategoryNotFoundError();
    }

    const renamed = category.rename(input.name);

    const existing = await this.categories.findByName(renamed.name);
    if (existing !== null && existing.id !== category.id) {
      throw new DuplicateCategoryNameError(existing.name);
    }

    return this.categories.update(renamed);
  }
}
