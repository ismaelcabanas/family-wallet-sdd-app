import { Tag } from "@/domain/tag/Tag";
import { DuplicateTagNameError, InvalidTagError } from "@/domain/tag/TagErrors";
import { deriveTagSlug } from "@/domain/tag/TagSlug";
import type { TagCategoryId } from "@/domain/tag-category/TagCategoryId";
import type { CategoryRepository } from "@/application/tag-category/CategoryRepository";
import { DEFAULT_CATEGORY_SLUG } from "@/domain/tag-category/DefaultCategory";
import { CategoryNotFoundError } from "@/domain/tag-category/TagCategoryErrors";

import type { TagRepository } from "./TagRepository";

export class CreateTag {
  constructor(
    private readonly tags: TagRepository,
    private readonly categories: CategoryRepository,
  ) {}

  async execute(input: { name: string; categoryId?: TagCategoryId }): Promise<Tag> {
    const name = input.name.trim();
    if (name === "") {
      throw new InvalidTagError("El nombre de la etiqueta es obligatorio.");
    }

    const existing = await this.tags.findByName(name);
    if (existing) {
      throw new DuplicateTagNameError(name);
    }

    const categoryId =
      input.categoryId === undefined
        ? await this.resolveDefaultCategoryId()
        : await this.resolveExplicitCategoryId(input.categoryId);

    const tag = await this.tags.save(
      Tag.create({
        name,
        slug: await this.resolveSlug(name),
        status: "active",
        categoryId,
      }),
    );

    return tag;
  }

  private async resolveExplicitCategoryId(categoryId: TagCategoryId): Promise<TagCategoryId> {
    const category = await this.categories.findById(categoryId);
    if (category === null || category.id === null) {
      throw new CategoryNotFoundError();
    }
    return category.id;
  }

  private async resolveDefaultCategoryId(): Promise<TagCategoryId> {
    const defaultCategory = await this.categories.findBySlug(DEFAULT_CATEGORY_SLUG);
    if (defaultCategory === null || defaultCategory.id === null) {
      throw new CategoryNotFoundError();
    }
    return defaultCategory.id;
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
