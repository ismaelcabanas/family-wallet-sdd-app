import { Tag } from "@/domain/tag/Tag";
import { TagCategory } from "@/domain/tag-category/TagCategory";
import { TagCategoryId } from "@/domain/tag-category/TagCategoryId";
import {
  DuplicateTagNameError,
  InactiveTagError,
  InvalidTagError,
} from "@/domain/tag/TagErrors";
import { describe, expect, it, vi, type Mock } from "vitest";

const { executeMock, findByIdMock } = vi.hoisted(() => ({
  executeMock: vi.fn(),
  findByIdMock: vi.fn(),
}));

vi.mock("@/application/tag/CreateTag", () => ({
  CreateTag: vi.fn().mockImplementation(function () {
    return { execute: executeMock };
  }),
}));

vi.mock("@/infrastructure/db/DrizzleTagCategoryRepository", () => ({
  DrizzleTagCategoryRepository: vi.fn().mockImplementation(function () {
    return { findById: findByIdMock };
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/infrastructure/db/client", () => ({ db: {} }));

import { createTag } from "@/infrastructure/primary/actions/create-tag.action";

const revalidatePathMock = (await import("next/cache")).revalidatePath as Mock;

describe("createTag (Server Action)", () => {
  it("nombre vacío devuelve ok:false con el mensaje exacto sin tocar el caso de uso", async () => {
    const result = await createTag("");

    expect(result).toEqual({ ok: false, message: "El nombre de la etiqueta es obligatorio." });
    expect(executeMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("nombre de solo espacios devuelve el mismo mensaje de obligatorio", async () => {
    const result = await createTag("   ");

    expect(result).toEqual({ ok: false, message: "El nombre de la etiqueta es obligatorio." });
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("éxito devuelve la tag como DTO, con el nombre trimeado, y revalida el layout", async () => {
    executeMock.mockResolvedValueOnce(Tag.rehydrate(15, "Mascotas", "mascotas", "active", TagCategoryId(1)));
    findByIdMock.mockResolvedValueOnce(TagCategory.rehydrate(1, "General", "general"));

    const result = await createTag("  Mascotas ");

    expect(result).toEqual({
      ok: true,
      tag: {
        id: 15,
        name: "Mascotas",
        slug: "mascotas",
        categoryId: 1,
        categoryName: "General",
      },
    });
    expect(executeMock).toHaveBeenCalledExactlyOnceWith({ name: "Mascotas" });
    expect(revalidatePathMock).toHaveBeenCalledExactlyOnceWith("/", "layout");
  });

  it("el DTO incluye categoryId y categoryName: la etiqueta inline nace en la genérica (027)", async () => {
    executeMock.mockResolvedValueOnce(Tag.rehydrate(15, "Mascotas", "mascotas", "active", TagCategoryId(1)));
    findByIdMock.mockResolvedValueOnce(TagCategory.rehydrate(1, "General", "general"));

    const result = await createTag("Mascotas");

    expect(findByIdMock).toHaveBeenCalledExactlyOnceWith(1);
    expect(result).toEqual({
      ok: true,
      tag: {
        id: 15,
        name: "Mascotas",
        slug: "mascotas",
        categoryId: 1,
        categoryName: "General",
      },
    });
    expect(revalidatePathMock).toHaveBeenCalledExactlyOnceWith("/", "layout");
  });

  it("DuplicateTagNameError se mapea al mensaje exacto del dominio", async () => {
    executeMock.mockRejectedValueOnce(new DuplicateTagNameError("luz"));

    const result = await createTag("luz");

    expect(result).toEqual({
      ok: false,
      message: 'Ya existe una etiqueta con el nombre "luz".',
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("InvalidTagError se mapea a su mensaje exacto", async () => {
    executeMock.mockRejectedValueOnce(new InvalidTagError("El slug de la etiqueta es obligatorio."));

    const result = await createTag("---");

    expect(result).toEqual({ ok: false, message: "El slug de la etiqueta es obligatorio." });
  });

  it("otro DomainError se mapea a un mensaje genérico sin lanzar al cliente", async () => {
    executeMock.mockRejectedValueOnce(new InactiveTagError());

    const result = await createTag("Cualquiera");

    expect(result).toEqual({
      ok: false,
      message: "No se ha podido crear la etiqueta. Inténtalo de nuevo.",
    });
  });
});
