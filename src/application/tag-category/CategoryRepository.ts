import type { TagCategory } from "@/domain/tag-category/TagCategory";
import type { TagCategoryId } from "@/domain/tag-category/TagCategoryId";

export interface CategoryRepository {
  findAll(): Promise<TagCategory[]>;
  findById(id: TagCategoryId): Promise<TagCategory | null>;
  findBySlug(slug: string): Promise<TagCategory | null>;
  findByName(name: string): Promise<TagCategory | null>;
  save(category: TagCategory): Promise<TagCategory>;
  update(category: TagCategory): Promise<TagCategory>;
  delete(id: TagCategoryId): Promise<void>;
  countTags(id: TagCategoryId): Promise<number>;
}
