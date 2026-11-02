import { Tag } from "@/domain/tag/Tag";
import { DuplicateTagNameError, InvalidTagError } from "@/domain/tag/TagErrors";
import { deriveTagSlug } from "@/domain/tag/TagSlug";
import type { CategoryRepository } from "@/application/tag-category/CategoryRepository";
import { DEFAULT_CATEGORY_SLUG } from "@/domain/tag-category/DefaultCategory";
import { CategoryNotFoundError } from "@/domain/tag-category/TagCategoryErrors";

import type { TagRepository } from "./TagRepository";

export class CreateTag {
  constructor(
    private readonly tags: TagRepository,
    private readonly categories: CategoryRepository,
  ) {}

  async execute(input: { name: string }): Promise<Tag> {
    const name = input.name.trim();
    if (name === "") {
      throw new InvalidTagError("El nombre de la etiqueta es obligatorio.");
    }

    const existing = await this.tags.findByName(name);
    if (existing) {
      throw new DuplicateTagNameError(name);
    }

    const defaultCategory = await this.categories.findBySlug(DEFAULT_CATEGORY_SLUG);
    if (defaultCategory === null || defaultCategory.id === null) {
      throw new CategoryNotFoundError();
    }

    const tag = await this.tags.save(
      Tag.create({
        name,
        slug: await this.resolveSlug(name),
        status: "active",
        categoryId: defaultCategory.id,
      }),
    );

    return tag;
  }

  private async resolveSlug(name: string): Promise<string> {
    const base = deriveTagSlug(name);
    let slug = base;
    for (let suffix = 2; (await this.tags.findBySlug(slug)) !== null; suffix++) {
      slug = `${base}-${suffix}`;
    }
    return slug;
  }
}
