import { Tag } from "@/domain/tag/Tag";
import { TagId } from "@/domain/tag/TagId";
import { DuplicateTagNameError, TagNotFoundError } from "@/domain/tag/TagErrors";
import { beforeEach, describe, expect, it } from "vitest";

import { InMemoryCatalogTagRepository } from "./InMemoryCatalogTagRepository";
import { ReactivateTag } from "./ReactivateTag";

describe("ReactivateTag", () => {
  let repository: InMemoryCatalogTagRepository;
  let useCase: ReactivateTag;

  beforeEach(() => {
    repository = new InMemoryCatalogTagRepository([
      Tag.rehydrate(1, "Luz apagada", "luz-apagada", "inactive"),
      Tag.rehydrate(2, "LUZ", "luz", "active"),
    ]);
    useCase = new ReactivateTag(repository);
  });

  it("reactiva persistiendo conStatus active vía update", async () => {
    const tag = await useCase.execute({ id: TagId(1) });

    expect(tag.status).toBe("active");
    expect(tag.name).toBe("Luz apagada");
    expect(repository.updated).toHaveLength(1);
    expect(repository.updated[0]?.status).toBe("active");
    expect(repository.stored.find((candidate) => candidate.id === 1)?.status).toBe("active");
  });

  it("rechaza la colisión de lower(name) con otra etiqueta (edge inactiva «Luz» vs activa «LUZ»)", async () => {
    repository.stored = [
      Tag.rehydrate(1, "Luz", "luz-apagada", "inactive"),
      Tag.rehydrate(2, "LUZ", "luz", "active"),
    ];

    await expect(useCase.execute({ id: TagId(1) })).rejects.toThrowError(
      new DuplicateTagNameError("Luz"),
    );
    expect(repository.updated).toHaveLength(0);
  });

  it("rechaza id desconocido", async () => {
    await expect(useCase.execute({ id: TagId(999) })).rejects.toThrowError(TagNotFoundError);
  });
});
