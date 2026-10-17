import { Tag } from "@/domain/tag/Tag";
import { TagId } from "@/domain/tag/TagId";
import {
  DuplicateTagNameError,
  InvalidTagError,
  ProtectedTagError,
  TagNotFoundError,
} from "@/domain/tag/TagErrors";
import { beforeEach, describe, expect, it } from "vitest";

import { InMemoryCatalogTagRepository } from "./InMemoryCatalogTagRepository";
import { RenameTag } from "./RenameTag";

describe("RenameTag", () => {
  let repository: InMemoryCatalogTagRepository;
  let useCase: RenameTag;

  beforeEach(() => {
    repository = new InMemoryCatalogTagRepository([
      Tag.rehydrate(1, "luz", "luz", "active"),
      Tag.rehydrate(2, "Ocio", "ocio", "active"),
      Tag.rehydrate(3, "Apagada", "apagada", "inactive"),
      Tag.rehydrate(100, "Aportación Común", "aportacion-comun", "active"),
    ]);
    useCase = new RenameTag(repository);
  });

  it("renombra cargando por id y persistiendo vía update", async () => {
    const tag = await useCase.execute({ id: TagId(1), name: "  Hogar  " });

    expect(tag.name).toBe("Hogar");
    expect(tag.id).toBe(1);
    expect(tag.slug).toBe("luz");
    expect(tag.status).toBe("active");
    expect(repository.updated).toHaveLength(1);
    expect(repository.stored.find((candidate) => candidate.id === 1)?.name).toBe("Hogar");
  });

  it("permite renombrar sobre sí misma cambiando solo la caja («luz»→«Luz»)", async () => {
    const tag = await useCase.execute({ id: TagId(1), name: "Luz" });

    expect(tag.name).toBe("Luz");
    expect(repository.updated).toHaveLength(1);
  });

  it("rechaza duplicado con otra etiqueta activa", async () => {
    await expect(useCase.execute({ id: TagId(1), name: "Ocio" })).rejects.toThrowError(
      new DuplicateTagNameError("Ocio"),
    );
    expect(repository.updated).toHaveLength(0);
  });

  it("rechaza duplicado con otra etiqueta inactiva", async () => {
    await expect(useCase.execute({ id: TagId(1), name: "Apagada" })).rejects.toThrowError(
      new DuplicateTagNameError("Apagada"),
    );
  });

  it("rechaza nombre vacío tras trim", async () => {
    await expect(useCase.execute({ id: TagId(1), name: "   " })).rejects.toThrowError(
      new InvalidTagError("El nombre de la etiqueta es obligatorio."),
    );
  });

  it("rechaza la etiqueta protegida por slug", async () => {
    await expect(useCase.execute({ id: TagId(100), name: "Otro nombre" })).rejects.toThrowError(
      new ProtectedTagError("Aportación Común"),
    );
  });

  it("rechaza id desconocido", async () => {
    await expect(useCase.execute({ id: TagId(999), name: "Nueva" })).rejects.toThrowError(
      TagNotFoundError,
    );
  });
});
