import { Tag } from "@/domain/tag/Tag";
import { TagId } from "@/domain/tag/TagId";
import {
  InvalidTagError,
  ProtectedTagError,
  TagNotFoundError,
} from "@/domain/tag/TagErrors";
import { beforeEach, describe, expect, it } from "vitest";

import { InMemoryCatalogTagRepository } from "./InMemoryCatalogTagRepository";
import { MergeTags } from "./MergeTags";

describe("MergeTags", () => {
  let repository: InMemoryCatalogTagRepository;
  let useCase: MergeTags;

  beforeEach(() => {
    repository = new InMemoryCatalogTagRepository([
      Tag.rehydrate(1, "super", "super", "active"),
      Tag.rehydrate(2, "super-casa", "super-casa", "active"),
      Tag.rehydrate(3, "Apagada", "apagada", "inactive"),
      Tag.rehydrate(100, "Aportación Común", "aportacion-comun", "active"),
    ]);
    useCase = new MergeTags(repository);
  });

  it("fusiona delegando en mergeInto con los ids en el orden correcto", async () => {
    const result = await useCase.execute({ absorbedId: TagId(2), targetId: TagId(1) });

    expect(result).toEqual({ reassignedMovements: 2 });
    expect(repository.merged).toEqual([{ absorbedId: 2, targetId: 1 }]);
  });

  it("permite fusionar hacia una etiqueta inactiva sin cambiar su estado", async () => {
    const result = await useCase.execute({ absorbedId: TagId(2), targetId: TagId(3) });

    expect(result.reassignedMovements).toBe(2);
    expect(repository.stored.find((tag) => tag.id === 3)?.status).toBe("inactive");
  });

  it("rechaza la etiqueta protegida como absorbida", async () => {
    await expect(useCase.execute({ absorbedId: TagId(100), targetId: TagId(1) })).rejects.toThrowError(
      new ProtectedTagError("Aportación Común"),
    );
    expect(repository.merged).toHaveLength(0);
  });

  it("rechaza la etiqueta protegida como resultante", async () => {
    await expect(useCase.execute({ absorbedId: TagId(1), targetId: TagId(100) })).rejects.toThrowError(
      new ProtectedTagError("Aportación Común"),
    );
    expect(repository.merged).toHaveLength(0);
  });

  it("rechaza fusionar una etiqueta consigo misma", async () => {
    await expect(useCase.execute({ absorbedId: TagId(1), targetId: TagId(1) })).rejects.toThrowError(
      new InvalidTagError("Elige dos etiquetas distintas."),
    );
  });

  it("rechaza ids desconocidos", async () => {
    await expect(useCase.execute({ absorbedId: TagId(999), targetId: TagId(1) })).rejects.toThrowError(
      TagNotFoundError,
    );
    await expect(useCase.execute({ absorbedId: TagId(1), targetId: TagId(999) })).rejects.toThrowError(
      TagNotFoundError,
    );
  });
});
