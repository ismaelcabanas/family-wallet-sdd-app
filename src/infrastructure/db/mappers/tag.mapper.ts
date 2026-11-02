import { Tag } from "@/domain/tag/Tag";
import { TagStatus } from "@/domain/tag/TagStatus";
import { TagCategoryId } from "@/domain/tag-category/TagCategoryId";

import type { TagRow } from "../schema/tags";

export function mapRowToTag(row: TagRow): Tag {
  return Tag.rehydrate(
    row.id,
    row.name,
    row.slug,
    row.status as TagStatus,
    TagCategoryId(row.categoryId),
  );
}
