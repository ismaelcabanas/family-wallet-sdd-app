import { ProtectedTagError, TagNotFoundError } from "@/domain/tag/TagErrors";
import { isProtectedTagSlug } from "@/domain/tag/SystemTags";
import type { Tag } from "@/domain/tag/Tag";
import type { TagId } from "@/domain/tag/TagId";

import type { TagRepository } from "./TagRepository";

export class DeactivateTag {
  constructor(private readonly tags: TagRepository) {}

  async execute(input: { id: TagId }): Promise<Tag> {
    const tag = await this.tags.findById(input.id);
    if (tag === null) {
      throw new TagNotFoundError();
    }

    if (isProtectedTagSlug(tag.slug)) {
      throw new ProtectedTagError(tag.name);
    }

    if (tag.status === "inactive") {
      return tag;
    }

    return this.tags.update(tag.withStatus("inactive"));
  }
}
