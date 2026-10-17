import { Tag } from "@/domain/tag/Tag";
import { DuplicateTagNameError } from "@/domain/tag/TagErrors";

import type { TagRepository } from "./TagRepository";

export class InMemoryCatalogTagRepository implements TagRepository {
  nextId = 100;
  stored: Tag[] = [];
  updated: Tag[] = [];
  merged: { absorbedId: number; targetId: number }[] = [];

  constructor(initial: Tag[] = []) {
    this.stored = initial;
  }

  async findAllActive(): Promise<Tag[]> {
    return this.stored
      .filter((tag) => tag.status === "active")
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }

  async findAll(): Promise<Tag[]> {
    return [...this.stored].sort((a, b) => a.name.localeCompare(b.name, "es"));
  }

  async findByIds(ids: readonly number[]): Promise<Tag[]> {
    return this.stored.filter((tag) => tag.id !== null && ids.includes(tag.id));
  }

  async findBySlug(slug: string): Promise<Tag | null> {
    return this.stored.find((tag) => tag.slug === slug) ?? null;
  }

  async findByName(name: string): Promise<Tag | null> {
    const lowered = name.toLowerCase();
    return this.stored.find((tag) => tag.name.toLowerCase() === lowered) ?? null;
  }

  async findById(id: number): Promise<Tag | null> {
    return this.stored.find((tag) => tag.id === (id as never)) ?? null;
  }

  async save(tag: Tag): Promise<Tag> {
    const duplicate = this.stored.find(
      (existing) => existing.name.toLowerCase() === tag.name.toLowerCase(),
    );
    if (duplicate) {
      throw new DuplicateTagNameError(tag.name);
    }
    const persisted = Tag.rehydrate(this.nextId++, tag.name, tag.slug, tag.status);
    this.stored.push(persisted);
    return persisted;
  }

  async update(tag: Tag): Promise<Tag> {
    const duplicate = this.stored.find(
      (existing) =>
        existing.name.toLowerCase() === tag.name.toLowerCase() && existing.id !== tag.id,
    );
    if (duplicate) {
      throw new DuplicateTagNameError(tag.name);
    }
    this.stored = this.stored.map((existing) =>
      existing.id === tag.id
        ? Tag.rehydrate(tag.id as number, tag.name, tag.slug, tag.status)
        : existing,
    );
    this.updated.push(tag);
    return tag;
  }

  async mergeInto(absorbedId: number, targetId: number): Promise<{ reassignedMovements: number }> {
    this.merged.push({ absorbedId, targetId });
    this.stored = this.stored.filter((tag) => tag.id !== (absorbedId as never));
    return { reassignedMovements: 2 };
  }
}
