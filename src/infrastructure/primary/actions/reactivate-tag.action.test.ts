import { describe, expect, it, vi, type Mock } from "vitest";

const { executeMock } = vi.hoisted(() => ({ executeMock: vi.fn() }));

vi.mock("@/application/tag/ReactivateTag", () => ({
  ReactivateTag: vi.fn().mockImplementation(function () {
    return { execute: executeMock };
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/infrastructure/db/client", () => ({ db: {} }));

import {
  reactivateTag,
  type ReactivateTagResult,
} from "@/infrastructure/primary/actions/reactivate-tag.action";

const revalidatePathMock = (await import("next/cache")).revalidatePath as Mock;

describe("reactivateTag (Server Action directa)", () => {
  it("éxito devuelve { ok: true } y revalida el layout", async () => {
    executeMock.mockResolvedValueOnce(undefined);

    const result: ReactivateTagResult = await reactivateTag(1);

    expect(result).toEqual({ ok: true });
    expect(executeMock).toHaveBeenCalledExactlyOnceWith({ id: 1 });
    expect(revalidatePathMock).toHaveBeenCalledWith("/", "layout");
  });

  it("mapea DuplicateTagNameError a su mensaje exacto", async () => {
    const { DuplicateTagNameError } = await import("@/domain/tag/TagErrors");
    executeMock.mockRejectedValueOnce(new DuplicateTagNameError("Luz"));

    const result = await reactivateTag(1);

    expect(result).toEqual({
      ok: false,
      message: 'Ya existe una etiqueta con el nombre "Luz".',
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("mapea TagNotFoundError a su mensaje exacto", async () => {
    const { TagNotFoundError } = await import("@/domain/tag/TagErrors");
    executeMock.mockRejectedValueOnce(new TagNotFoundError());

    const result = await reactivateTag(999);

    expect(result).toEqual({
      ok: false,
      message: "Una de las etiquetas seleccionadas ya no está disponible.",
    });
  });

  it("mapea ProtectedTagError a su mensaje exacto", async () => {
    const { ProtectedTagError } = await import("@/domain/tag/TagErrors");
    executeMock.mockRejectedValueOnce(new ProtectedTagError("Aportación Común"));

    const result = await reactivateTag(100);

    expect(result).toEqual({
      ok: false,
      message: 'La etiqueta "Aportación Común" pertenece al sistema y no puede modificarse.',
    });
  });

  it("nunca lanza: mapea cualquier otro error al mensaje genérico", async () => {
    executeMock.mockRejectedValueOnce(new Error("BD caída"));

    const result = await reactivateTag(1);

    expect(result).toEqual({
      ok: false,
      message: "No se ha podido completar la operación. Inténtalo de nuevo.",
    });
  });
});
