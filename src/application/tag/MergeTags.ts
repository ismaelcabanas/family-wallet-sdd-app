import { InvalidTagError, ProtectedTagError, TagNotFoundError } from "@/domain/tag/TagErrors";
import { isProtectedTagSlug } from "@/domain/tag/SystemTags";
import type { TagId } from "@/domain/tag/TagId";

import type { TagRepository } from "./TagRepository";

export class MergeTags {
  constructor(private readonly tags: TagRepository) {}

  async execute(input: {
    absorbedId: TagId;
    targetId: TagId;
  }): Promise<{ reassignedMovements: number }> {
    const absorbed = await this.tags.findById(input.absorbedId);
    if (absorbed === null) {
      throw new TagNotFoundError();
    }

    const target = await this.tags.findById(input.targetId);
    if (target === null) {
      throw new TagNotFoundError();
    }

    if (absorbed.id === target.id) {
      throw new InvalidTagError("Elige dos etiquetas distintas.");
    }

    if (isProtectedTagSlug(absorbed.slug)) {
      throw new ProtectedTagError(absorbed.name);
    }

    if (isProtectedTagSlug(target.slug)) {
      throw new ProtectedTagError(target.name);
    }

    return this.tags.mergeInto(input.absorbedId, input.targetId);
  }
}
