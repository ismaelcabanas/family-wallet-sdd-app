import type { Tag } from "@/domain/tag/Tag";
import type { TagId } from "@/domain/tag/TagId";

export interface TagRepository {
  findAllActive(): Promise<Tag[]>;
  findByIds(ids: readonly TagId[]): Promise<Tag[]>;
  findBySlug(slug: string): Promise<Tag | null>;
}
