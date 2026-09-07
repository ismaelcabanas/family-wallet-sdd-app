import { Tag } from "@/domain/tag/Tag";
import { TagStatus } from "@/domain/tag/TagStatus";

import type { TagRow } from "../schema/tags";

export function mapRowToTag(row: TagRow): Tag {
  return Tag.rehydrate(row.id, row.name, row.slug, row.status as TagStatus);
}
