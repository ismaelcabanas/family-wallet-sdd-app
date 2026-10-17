import { Tag } from "@/domain/tag/Tag";
import { TagId } from "@/domain/tag/TagId";
import { ProtectedTagError, TagNotFoundError } from "@/domain/tag/TagErrors";
import { beforeEach, describe, expect, it } from "vitest";

import { InMemoryCatalogTagRepository } from "./InMemoryCatalogTagRepository";
import { DeactivateTag } from "./DeactivateTag";

describe("DeactivateTag", () => {
  let repository: InMemoryCatalogTagRepository;
  let useCase: DeactivateTag;

  beforeEach(() => {
    repository = new InMemoryCatalogTagRepository([
      Tag.rehydrate(1, "Luz", "luz", "active"),
      Tag.rehydrate(100, "Aportación Común", "aportacion-comun", "active"),
    ]);
    useCase = new DeactivateTag(repository);
  });

  it("desactiva persistiendo conStatus inactive vía update", async () => {
    const tag = await useCase.execute({ id: TagId(1) });

    expect(tag.status).toBe("inactive");
    expect(tag.name).toBe("Luz");
    expect(repository.updated).toHaveLength(1);
    expect(repository.updated[0]?.status).toBe("inactive");
    expect(repository.stored.find((candidate) => candidate.id === 1)?.status).toBe("inactive");
  });

  it("rechaza la etiqueta protegida", async () => {
    await expect(useCase.execute({ id: TagId(100) })).rejects.toThrowError(
      new ProtectedTagError("Aportación Común"),
    );
    expect(repository.updated).toHaveLength(0);
  });

  it("rechaza id desconocido", async () => {
    await expect(useCase.execute({ id: TagId(999) })).rejects.toThrowError(TagNotFoundError);
  });

  it("es idempotente si ya está inactiva (no llama a update)", async () => {
    repository.stored = [Tag.rehydrate(1, "Luz", "luz", "inactive")];

    const tag = await useCase.execute({ id: TagId(1) });

    expect(tag.status).toBe("inactive");
    expect(repository.updated).toHaveLength(0);
  });
});
