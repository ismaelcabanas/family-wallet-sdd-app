import type { CategoryDTO } from "@/application/tag-category/dto";
import type { TagDTO } from "../movement/dto";
import type { TagStatus } from "@/domain/tag/TagStatus";

export interface CatalogTagDTO {
  id: number;
  name: string;
  slug: string;
  status: TagStatus;
  isProtected: boolean;
}

export interface TagCatalogGroupDTO {
  category: CategoryDTO;
  tags: CatalogTagDTO[];
}

export interface ActiveTagGroupDTO {
  category: CategoryDTO;
  tags: TagDTO[];
}
