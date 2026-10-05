import { Tag } from "@/domain/tag/Tag";
import { DuplicateTagNameError, InvalidTagError } from "@/domain/tag/TagErrors";
import { beforeEach, describe, expect, it } from "vitest";

import type { TagRepository } from "./TagRepository";
import { CreateTag } from "./CreateTag";

class InMemoryTagRepository implements TagRepository {
  nextId = 100;
  stored: Tag[] = [];

  constructor(initial: Tag[] = []) {
    this.stored = initial;
  }

  async findAllActive(): Promise<Tag[]> {
    return this.stored.filter((tag) => tag.status === "active");
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
}

describe("CreateTag", () => {
  let repository: InMemoryTagRepository;
  let useCase: CreateTag;

  beforeEach(() => {
    repository = new InMemoryTagRepository([
      Tag.rehydrate(1, "Luz", "luz", "active"),
      Tag.rehydrate(2, "Inactiva", "inactiva", "inactive"),
      Tag.rehydrate(3, "Alimentacion", "alimentacion", "active"),
      Tag.rehydrate(9, "Sin Clasificar", "sin-clasificar", "active"),
    ]);
    useCase = new CreateTag(repository);
  });

  it("crea una etiqueta activa con nombre trimeado y slug derivado", async () => {
    const tag = await useCase.execute({ name: "  Mascotas  " });

    expect(tag.id).toBe(100);
    expect(tag.name).toBe("Mascotas");
    expect(tag.slug).toBe("mascotas");
    expect(tag.status).toBe("active");
    expect(repository.stored).toHaveLength(5);
  });

  it("rechaza nombre vacío o de solo espacios", async () => {
    await expect(useCase.execute({ name: "" })).rejects.toThrowError(InvalidTagError);
    await expect(useCase.execute({ name: "   " })).rejects.toThrowError(InvalidTagError);
    await expect(useCase.execute({ name: "" })).rejects.toThrowError(
      "El nombre de la etiqueta es obligatorio.",
    );
  });

  it("rechaza duplicado exacto y case-insensitive (LUZ vs Luz)", async () => {
    await expect(useCase.execute({ name: "Luz" })).rejects.toThrowError(DuplicateTagNameError);
    await expect(useCase.execute({ name: "LUZ" })).rejects.toThrowError(
      new DuplicateTagNameError("LUZ"),
    );
  });

  it("rechaza duplicado de una etiqueta inactiva (la unicidad ignora estado)", async () => {
    await expect(useCase.execute({ name: "inactiva" })).rejects.toThrowError(
      new DuplicateTagNameError("inactiva"),
    );
  });

  it("resuelve colisión de slug con sufijo -2 (Alimentación vs Alimentacion)", async () => {
    const tag = await useCase.execute({ name: "Alimentación" });

    expect(tag.slug).toBe("alimentacion-2");
    expect(tag.name).toBe("Alimentación");
  });

  it("encadena sufijos -2, -3, … hasta encontrar hueco", async () => {
    await useCase.execute({ name: "Alimentación" });

    const tag = await useCase.execute({ name: "Alimentación-" });

    expect(tag.slug).toBe("alimentacion-3");
  });

  it("rechaza nombres de solo símbolos (slug derivado vacío → InvalidTagError)", async () => {
    await expect(useCase.execute({ name: "---" })).rejects.toThrowError(InvalidTagError);
  });
});
