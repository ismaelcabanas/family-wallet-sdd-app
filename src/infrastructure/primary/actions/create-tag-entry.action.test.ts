import { Tag } from "@/domain/tag/Tag";
import { TagCategoryId } from "@/domain/tag-category/TagCategoryId";
import { DomainError } from "@/domain/shared/DomainError";
import { DuplicateTagNameError } from "@/domain/tag/TagErrors";
import {
  CategoryNotFoundError,
  DuplicateCategoryNameError,
} from "@/domain/tag-category/TagCategoryErrors";
import { describe, expect, it, vi, type Mock } from "vitest";

const { createTagExecuteMock, createCategoryExecuteMock } = vi.hoisted(() => ({
  createTagExecuteMock: vi.fn(),
  createCategoryExecuteMock: vi.fn(),
}));

vi.mock("@/application/tag/CreateTag", () => ({
  CreateTag: vi.fn().mockImplementation(function () {
    return { execute: createTagExecuteMock };
  }),
}));

vi.mock("@/application/tag-category/CreateCategory", () => ({
  CreateCategory: vi.fn().mockImplementation(function () {
    return { execute: createCategoryExecuteMock };
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/infrastructure/db/client", () => ({ db: {} }));

vi.mock("@/infrastructure/db/DrizzleTagRepository", () => ({
  DrizzleTagRepository: vi.fn(),
}));

vi.mock("@/infrastructure/db/DrizzleTagCategoryRepository", () => ({
  DrizzleTagCategoryRepository: vi.fn(),
}));

import {
  createTagEntry,
  type TagEntryActionState,
} from "@/infrastructure/primary/actions/create-tag-entry.action";

const revalidatePathMock = (await import("next/cache")).revalidatePath as Mock;

function buildFormData(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  formData.set("name", "Netflix");
  for (const [key, value] of Object.entries(overrides)) {
    formData.set(key, value);
  }
  return formData;
}

async function run(formData: FormData): Promise<TagEntryActionState> {
  return createTagEntry({ status: "idle" }, formData);
}

describe("createTagEntry (Server Action)", () => {
  it("sin categoryId despacha a CreateCategory (inferencia: sin padre ⇒ categoría)", async () => {
    createCategoryExecuteMock.mockResolvedValueOnce(undefined);

    const state = await run(buildFormData());

    expect(state).toEqual({ status: "success", message: "Categoría creada" });
    expect(createCategoryExecuteMock).toHaveBeenCalledExactlyOnceWith({ name: "Netflix" });
    expect(createTagExecuteMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledExactlyOnceWith("/", "layout");
  });

  it("categoryId vacío del Select se trata como ausente (vía categoría)", async () => {
    createCategoryExecuteMock.mockResolvedValueOnce(undefined);

    const state = await run(buildFormData({ categoryId: "" }));

    expect(state).toEqual({ status: "success", message: "Categoría creada" });
    expect(createCategoryExecuteMock).toHaveBeenCalledExactlyOnceWith({ name: "Netflix" });
    expect(createTagExecuteMock).not.toHaveBeenCalled();
  });

  it("con categoryId despacha a CreateTag (con padre ⇒ etiqueta)", async () => {
    createTagExecuteMock.mockResolvedValueOnce(
      Tag.rehydrate(15, "Netflix", "netflix", "active", TagCategoryId(2)),
    );

    const state = await run(buildFormData({ categoryId: "2" }));

    expect(state).toEqual({ status: "success", message: "Etiqueta creada" });
    expect(createTagExecuteMock).toHaveBeenCalledExactlyOnceWith({ name: "Netflix", categoryId: 2 });
    expect(createCategoryExecuteMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledExactlyOnceWith("/", "layout");
  });

  it("Zod rechaza el nombre vacío tras trim sin delegar en los casos de uso", async () => {
    const state = await run(buildFormData({ name: "   " }));

    expect(state).toEqual({ status: "error", message: "El nombre es obligatorio." });
    expect(createCategoryExecuteMock).not.toHaveBeenCalled();
    expect(createTagExecuteMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("Zod rechaza categoryId no positivo", async () => {
    const zero = await run(buildFormData({ categoryId: "0" }));
    expect(zero).toEqual({ status: "error", message: "La categoría seleccionada no es válida." });

    const negative = await run(buildFormData({ categoryId: "-1" }));
    expect(negative).toEqual({ status: "error", message: "La categoría seleccionada no es válida." });
    expect(createTagExecuteMock).not.toHaveBeenCalled();
    expect(createCategoryExecuteMock).not.toHaveBeenCalled();
  });

  it("mapea DuplicateTagNameError al mensaje exacto", async () => {
    createTagExecuteMock.mockRejectedValueOnce(new DuplicateTagNameError("Netflix"));

    const state = await run(buildFormData({ categoryId: "2" }));

    expect(state).toEqual({
      status: "error",
      message: 'Ya existe una etiqueta con el nombre "Netflix".',
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("mapea DuplicateCategoryNameError al mensaje exacto (vía sin padre)", async () => {
    createCategoryExecuteMock.mockRejectedValueOnce(new DuplicateCategoryNameError("Suscripciones"));

    const state = await run(buildFormData({ name: "Suscripciones" }));

    expect(state).toEqual({
      status: "error",
      message: 'Ya existe una categoría con el nombre "Suscripciones".',
    });
  });

  it("mapea CategoryNotFoundError al mensaje exacto (edge otra pestaña)", async () => {
    createTagExecuteMock.mockRejectedValueOnce(new CategoryNotFoundError());

    const state = await run(buildFormData({ categoryId: "99" }));

    expect(state).toEqual({
      status: "error",
      message: "La categoría seleccionada ya no está disponible.",
    });
  });

  it("mapea cualquier otro DomainError al mensaje genérico", async () => {
    createCategoryExecuteMock.mockRejectedValueOnce(
      new (class extends DomainError {})("falla inesperada"),
    );

    const state = await run(buildFormData());

    expect(state).toEqual({
      status: "error",
      message: "No se ha podido completar la operación. Inténtalo de nuevo.",
    });
  });

  it("nunca lanza al cliente ante un error no de dominio", async () => {
    createCategoryExecuteMock.mockRejectedValueOnce(new Error("BD caída"));

    const state = await run(buildFormData());

    expect(state).toEqual({
      status: "error",
      message: "No se ha podido completar la operación. Inténtalo de nuevo.",
    });
  });
});
