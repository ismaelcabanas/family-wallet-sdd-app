import type { TagCategoryId } from "@/domain/tag-category/TagCategoryId";
import { isDefaultCategorySlug } from "@/domain/tag-category/DefaultCategory";
import {
  CategoryNotFoundError,
  CategoryNotEmptyError,
  ProtectedCategoryError,
} from "@/domain/tag-category/TagCategoryErrors";

import type { CategoryRepository } from "./CategoryRepository";

export class DeleteCategory {
  constructor(private readonly categories: CategoryRepository) {}

  async execute(input: { categoryId: TagCategoryId }): Promise<void> {
    const category = await this.categories.findById(input.categoryId);
    if (category === null) {
      throw new CategoryNotFoundError();
    }

    if (isDefaultCategorySlug(category.slug)) {
      throw new ProtectedCategoryError(category.name);
    }

    const tagCount = await this.categories.countTags(input.categoryId);
    if (tagCount > 0) {
      throw new CategoryNotEmptyError(category.name);
    }

    await this.categories.delete(input.categoryId);
  }
}
