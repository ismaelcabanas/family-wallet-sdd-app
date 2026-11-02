import { describe, expect, it, vi, type Mock } from "vitest";

const { executeMock } = vi.hoisted(() => ({ executeMock: vi.fn() }));

vi.mock("@/application/tag/MoveTagToCategory", () => ({
  MoveTagToCategory: vi.fn().mockImplementation(function () {
    return { execute: executeMock };
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/infrastructure/db/client", () => ({ db: {} }));

import {
  moveTagToCategory,
  type CategoryActionState,
} from "@/infrastructure/primary/actions/move-tag-to-category.action";

const revalidatePathMock = (await import("next/cache")).revalidatePath as Mock;

function buildFormData(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  formData.set("tagId", "5");
  formData.set("categoryId", "2");
  for (const [key, value] of Object.entries(overrides)) {
    formData.set(key, value);
  }
  return formData;
}

async function run(formData: FormData): Promise<CategoryActionState> {
  return moveTagToCategory({ status: "idle" }, formData);
}

describe("moveTagToCategory (Server Action)", () => {
  it("éxito devuelve el estado con mensaje y revalida solo /tags", async () => {
    const { Tag } = await import("@/domain/tag/Tag");
    const { TagCategory } = await import("@/domain/tag-category/TagCategory");
    const { TagCategoryId } = await import("@/domain/tag-category/TagCategoryId");
    executeMock.mockResolvedValueOnce({
      tag: Tag.rehydrate(5, "Supermercado", "supermercado", "active", TagCategoryId(2)),
      category: TagCategory.rehydrate(2, "Comida", "comida"),
    });

    const state = await run(buildFormData());

    expect(state).toEqual({ status: "success", message: "Etiqueta movida a Comida" });
    expect(executeMock).toHaveBeenCalledExactlyOnceWith({ tagId: 5, categoryId: 2 });
    expect(revalidatePathMock).toHaveBeenCalledWith("/tags");
  });

  it("Zod rechaza ids no numéricos sin delegar", async () => {
    const state = await run(buildFormData({ tagId: "abc" }));

    expect(state.status).toBe("error");
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("mapea TagNotFoundError a su mensaje exacto", async () => {
    const { TagNotFoundError } = await import("@/domain/tag/TagErrors");
    executeMock.mockRejectedValueOnce(new TagNotFoundError());

    const state = await run(buildFormData());

    expect(state).toEqual({
      status: "error",
      message: "Una de las etiquetas seleccionadas ya no está disponible.",
    });
  });

  it("mapea CategoryNotFoundError a su mensaje exacto", async () => {
    const { CategoryNotFoundError } = await import("@/domain/tag-category/TagCategoryErrors");
    executeMock.mockRejectedValueOnce(new CategoryNotFoundError());

    const state = await run(buildFormData());

    expect(state).toEqual({
      status: "error",
      message: "La categoría seleccionada ya no está disponible.",
    });
  });

  it("mapea cualquier otro DomainError al mensaje genérico y nunca lanza", async () => {
    const { DomainError } = await import("@/domain/shared/DomainError");
    executeMock.mockRejectedValueOnce(new (class extends DomainError {})("falla inesperada"));

    const state = await run(buildFormData());

    expect(state).toEqual({
      status: "error",
      message: "No se ha podido completar la operación. Inténtalo de nuevo.",
    });
  });
});
