import type { TagStatus } from "@/domain/tag/TagStatus";

export interface CatalogTagDTO {
  id: number;
  name: string;
  slug: string;
  status: TagStatus;
  isProtected: boolean;
}
