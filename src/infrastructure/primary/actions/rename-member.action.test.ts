import { describe, expect, it, vi, type Mock } from "vitest";

const { executeMock } = vi.hoisted(() => ({ executeMock: vi.fn() }));

vi.mock("@/application/member/RenameMember", () => ({
  RenameMember: vi.fn().mockImplementation(function () {
    return { execute: executeMock };
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/infrastructure/db/client", () => ({ db: {} }));

import {
  renameMember,
  type MemberActionState,
} from "@/infrastructure/primary/actions/rename-member.action";

const revalidatePathMock = (await import("next/cache")).revalidatePath as Mock;

function buildFormData(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  formData.set("memberId", "1");
  formData.set("name", "Isma");
  for (const [key, value] of Object.entries(overrides)) {
    formData.set(key, value);
  }
  return formData;
}

async function run(formData: FormData): Promise<MemberActionState> {
  return renameMember({ status: "idle" }, formData);
}

describe("renameMember (Server Action)", () => {
  it("éxito devuelve el estado con mensaje y revalida el layout", async () => {
    executeMock.mockResolvedValueOnce(undefined);

    const state = await run(buildFormData());

    expect(state).toEqual({ status: "success", message: "Miembro renombrado" });
    expect(executeMock).toHaveBeenCalledExactlyOnceWith({ id: 1, name: "Isma" });
    expect(revalidatePathMock).toHaveBeenCalledWith("/", "layout");
  });

  it("Zod rechaza el nombre vacío tras trim sin delegar en el caso de uso", async () => {
    const state = await run(buildFormData({ name: "   " }));

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.message).toBe("El nombre del miembro es obligatorio.");
      expect(state.values.name).toBe("   ");
    }
    expect(executeMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("Zod rechaza un memberId no numérico sin delegar", async () => {
    const state = await run(buildFormData({ memberId: "abc" }));

    expect(state.status).toBe("error");
    expect(executeMock).not.toHaveBeenCalled();
  });

  it.each([
    ["InvalidMemberError", "El nombre del miembro es obligatorio."],
    ["DuplicateMemberNameError", 'Ya existe un miembro con el nombre "ISMA".'],
    ["MemberNotFoundError", "El miembro seleccionado no existe."],
  ])("mapea %s a su mensaje exacto", async (label, message) => {
    const { InvalidMemberError, DuplicateMemberNameError, MemberNotFoundError } = await import(
      "@/domain/member/MemberErrors"
    );
    const error =
      label === "InvalidMemberError"
        ? new InvalidMemberError(message)
        : label === "DuplicateMemberNameError"
          ? new DuplicateMemberNameError("ISMA")
          : new MemberNotFoundError();
    executeMock.mockRejectedValueOnce(error);

    const state = await run(buildFormData());

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.message).toBe(message);
    }
  });

  it("mapea cualquier otro DomainError al mensaje genérico de miembro", async () => {
    const { DomainError } = await import("@/domain/shared/DomainError");
    executeMock.mockRejectedValueOnce(new (class extends DomainError {})("falla inesperada"));

    const state = await run(buildFormData());

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.message).toBe("No se ha podido renombrar el miembro.");
    }
  });

  it("nunca lanza al cliente ante un error no de dominio", async () => {
    executeMock.mockRejectedValueOnce(new Error("BD caída"));

    const state = await run(buildFormData());

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.message).toBe("No se ha podido renombrar el miembro.");
    }
  });

  it("ante error conserva el nombre enviado en values", async () => {
    const { DuplicateMemberNameError } = await import("@/domain/member/MemberErrors");
    executeMock.mockRejectedValueOnce(new DuplicateMemberNameError("ISMA"));

    const state = await run(buildFormData({ name: "  ISMA  " }));

    expect(state).toEqual({
      status: "error",
      message: 'Ya existe un miembro con el nombre "ISMA".',
      values: { name: "  ISMA  " },
    });
  });
});
