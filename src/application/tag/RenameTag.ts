import { DuplicateTagNameError, ProtectedTagError, TagNotFoundError } from "@/domain/tag/TagErrors";
import { isProtectedTagSlug } from "@/domain/tag/SystemTags";
import type { Tag } from "@/domain/tag/Tag";
import type { TagId } from "@/domain/tag/TagId";

import type { TagRepository } from "./TagRepository";

export class RenameTag {
  constructor(private readonly tags: TagRepository) {}

  async execute(input: { id: TagId; name: string }): Promise<Tag> {
    const tag = await this.tags.findById(input.id);
    if (tag === null) {
      throw new TagNotFoundError();
    }

    if (isProtectedTagSlug(tag.slug)) {
      throw new ProtectedTagError(tag.name);
    }

    const renamed = tag.rename(input.name);

    const existing = await this.tags.findByName(renamed.name);
    if (existing !== null && existing.id !== tag.id) {
      throw new DuplicateTagNameError(renamed.name);
    }

    return this.tags.update(renamed);
  }
}
