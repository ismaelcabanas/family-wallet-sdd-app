import { TagCategory } from "@/domain/tag-category/TagCategory";

import type { TagCategoryRow } from "../schema/tag-categories";

export function mapRowToTagCategory(row: TagCategoryRow): TagCategory {
  return TagCategory.rehydrate(row.id, row.name, row.slug);
}
