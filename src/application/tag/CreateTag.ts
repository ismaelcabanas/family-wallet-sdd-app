import { Tag } from "@/domain/tag/Tag";
import { DuplicateTagNameError, InvalidTagError } from "@/domain/tag/TagErrors";
import { deriveTagSlug } from "@/domain/tag/TagSlug";

import type { TagRepository } from "./TagRepository";

export class CreateTag {
  constructor(private readonly tags: TagRepository) {}

  async execute(input: { name: string }): Promise<Tag> {
    const name = input.name.trim();
    if (name === "") {
      throw new InvalidTagError("El nombre de la etiqueta es obligatorio.");
    }

    const existing = await this.tags.findByName(name);
    if (existing) {
      throw new DuplicateTagNameError(name);
    }

    const tag = await this.tags.save(
      Tag.create({ name, slug: await this.resolveSlug(name), status: "active" }),
    );

    return tag;
  }

  private async resolveSlug(name: string): Promise<string> {
    const base = deriveTagSlug(name);
    let slug = base;
    for (let suffix = 2; (await this.tags.findBySlug(slug)) !== null; suffix++) {
      slug = `${base}-${suffix}`;
    }
    return slug;
  }
}
