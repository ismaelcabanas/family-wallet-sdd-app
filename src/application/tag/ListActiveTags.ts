import type { TagDTO } from "../movement/dto";
import type { TagRepository } from "./TagRepository";

export class ListActiveTags {
  constructor(private readonly tags: TagRepository) {}

  async execute(): Promise<TagDTO[]> {
    const activeTags = await this.tags.findAllActive();
    return activeTags
      .flatMap((tag) =>
        tag.id === null ? [] : [{ id: tag.id, name: tag.name, slug: tag.slug }],
      )
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }
}
