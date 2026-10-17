import { DuplicateTagNameError, TagNotFoundError } from "@/domain/tag/TagErrors";
import type { Tag } from "@/domain/tag/Tag";
import type { TagId } from "@/domain/tag/TagId";

import type { TagRepository } from "./TagRepository";

export class ReactivateTag {
  constructor(private readonly tags: TagRepository) {}

  async execute(input: { id: TagId }): Promise<Tag> {
    const tag = await this.tags.findById(input.id);
    if (tag === null) {
      throw new TagNotFoundError();
    }

    const existing = await this.tags.findByName(tag.name);
    if (existing !== null && existing.id !== tag.id) {
      throw new DuplicateTagNameError(tag.name);
    }

    return this.tags.update(tag.withStatus("active"));
  }
}
