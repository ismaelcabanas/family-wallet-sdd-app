import { isProtectedTagSlug } from "@/domain/tag/SystemTags";

import type { CatalogTagDTO } from "./dto";
import type { TagRepository } from "./TagRepository";

export class ListTags {
  constructor(private readonly tags: TagRepository) {}

  async execute(): Promise<CatalogTagDTO[]> {
    const all = await this.tags.findAll();

    return all
      .flatMap((tag) => (tag.id === null ? [] : [{
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        status: tag.status,
        isProtected: isProtectedTagSlug(tag.slug),
      }]))
      .sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === "active" ? -1 : 1;
        }
        return a.name.localeCompare(b.name, "es");
      });
  }
}
