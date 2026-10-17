import { Tag } from "@/domain/tag/Tag";
import { beforeEach, describe, expect, it } from "vitest";

import { InMemoryCatalogTagRepository } from "./InMemoryCatalogTagRepository";
import { ListTags } from "./ListTags";

describe("ListTags", () => {
  let repository: InMemoryCatalogTagRepository;
  let useCase: ListTags;

  beforeEach(() => {
    repository = new InMemoryCatalogTagRepository([
      Tag.rehydrate(100, "Aportación Común", "aportacion-comun", "active"),
      Tag.rehydrate(1, "Ocio", "ocio", "active"),
      Tag.rehydrate(2, "Alimentación", "alimentacion", "active"),
      Tag.rehydrate(3, "Zapatos", "zapatos", "inactive"),
      Tag.rehydrate(4, "Apagada", "apagada", "inactive"),
    ]);
    useCase = new ListTags(repository);
  });

  it("mapea findAll a CatalogTagDTO con isProtected solo para el slug de sistema", async () => {
    const dtos = await useCase.execute();

    expect(dtos).toEqual([
      { id: 2, name: "Alimentación", slug: "alimentacion", status: "active", isProtected: false },
      { id: 100, name: "Aportación Común", slug: "aportacion-comun", status: "active", isProtected: true },
      { id: 1, name: "Ocio", slug: "ocio", status: "active", isProtected: false },
      { id: 4, name: "Apagada", slug: "apagada", status: "inactive", isProtected: false },
      { id: 3, name: "Zapatos", slug: "zapatos", status: "inactive", isProtected: false },
    ]);
  });

  it("ordena activas primero y luego inactivas, cada bloque alfabético", async () => {
    const dtos = await useCase.execute();

    expect(dtos.map((dto) => dto.status)).toEqual([
      "active",
      "active",
      "active",
      "inactive",
      "inactive",
    ]);
    expect(dtos.slice(0, 3).map((dto) => dto.name)).toEqual([
      "Alimentación",
      "Aportación Común",
      "Ocio",
    ]);
    expect(dtos.slice(3).map((dto) => dto.name)).toEqual(["Apagada", "Zapatos"]);
  });

  it("no incluye recuento de movimientos", async () => {
    const dtos = await useCase.execute();

    for (const dto of dtos) {
      expect(Object.keys(dto).sort()).toEqual(["id", "isProtected", "name", "slug", "status"]);
    }
  });
});
