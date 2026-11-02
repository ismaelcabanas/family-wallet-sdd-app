import { TagCategory } from "@/domain/tag-category/TagCategory";
import { DuplicateCategoryNameError } from "@/domain/tag-category/TagCategoryErrors";

import type { CategoryRepository } from "./CategoryRepository";

export class InMemoryCategoryRepository implements CategoryRepository {
  nextId = 100;
  stored: TagCategory[] = [];
  deleted: number[] = [];
  countTagsOverride: Map<number, number> = new Map();

  constructor(initial: TagCategory[] = []) {
    this.stored = initial;
  }

  async findAll(): Promise<TagCategory[]> {
    return [...this.stored].sort((a, b) => a.name.localeCompare(b.name, "es"));
  }

  async findById(id: number): Promise<TagCategory | null> {
    return this.stored.find((category) => category.id === (id as never)) ?? null;
  }

  async findBySlug(slug: string): Promise<TagCategory | null> {
    return this.stored.find((category) => category.slug === slug) ?? null;
  }

  async findByName(name: string): Promise<TagCategory | null> {
    const lowered = name.toLowerCase();
    return this.stored.find((category) => category.name.toLowerCase() === lowered) ?? null;
  }

  async save(category: TagCategory): Promise<TagCategory> {
    const duplicate = this.stored.find(
      (existing) => existing.name.toLowerCase() === category.name.toLowerCase(),
    );
    if (duplicate) {
      throw new DuplicateCategoryNameError(duplicate.name);
    }
    const persisted = TagCategory.rehydrate(
      this.nextId++,
      category.name,
      category.slug,
    );
    this.stored.push(persisted);
    return persisted;
  }

  async update(category: TagCategory): Promise<TagCategory> {
    const duplicate = this.stored.find(
      (existing) =>
        existing.name.toLowerCase() === category.name.toLowerCase() &&
        existing.id !== category.id,
    );
    if (duplicate) {
      throw new DuplicateCategoryNameError(duplicate.name);
    }
    this.stored = this.stored.map((existing) =>
      existing.id === category.id
        ? TagCategory.rehydrate(category.id as number, category.name, category.slug)
        : existing,
    );
    return category;
  }

  async delete(id: number): Promise<void> {
    this.deleted.push(id);
    this.stored = this.stored.filter((category) => category.id !== (id as never));
  }

  async countTags(id: number): Promise<number> {
    return this.countTagsOverride.get(id) ?? 0;
  }
}
