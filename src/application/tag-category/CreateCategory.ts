import { deriveSlug } from "@/domain/shared/slug";
import { TagCategory } from "@/domain/tag-category/TagCategory";
import {
  DuplicateCategoryNameError,
  InvalidCategoryError,
} from "@/domain/tag-category/TagCategoryErrors";

import type { CategoryRepository } from "./CategoryRepository";

export class CreateCategory {
  constructor(private readonly categories: CategoryRepository) {}

  async execute(input: { name: string }): Promise<TagCategory> {
    const name = input.name.trim();
    if (name === "") {
      throw new InvalidCategoryError();
    }

    const existing = await this.categories.findByName(name);
    if (existing) {
      throw new DuplicateCategoryNameError(existing.name);
    }

    return this.categories.save(
      TagCategory.create({ name, slug: await this.resolveSlug(name) }),
    );
  }

  private async resolveSlug(name: string): Promise<string> {
    const base = deriveSlug(name);
    let slug = base;
    for (let suffix = 2; (await this.categories.findBySlug(slug)) !== null; suffix++) {
      slug = `${base}-${suffix}`;
    }
    return slug;
  }
}
