import { describe, expect, it, vi, type Mock } from "vitest";

const { executeMock } = vi.hoisted(() => ({ executeMock: vi.fn() }));

vi.mock("@/application/account/RenameAccount", () => ({
  RenameAccount: vi.fn().mockImplementation(function () {
    return { execute: executeMock };
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/infrastructure/db/client", () => ({ db: {} }));

import {
  renameAccount,
  type AccountActionState,
} from "@/infrastructure/primary/actions/rename-account.action";

const revalidatePathMock = (await import("next/cache")).revalidatePath as Mock;

function buildFormData(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  formData.set("accountId", "3");
  formData.set("name", "Cuenta conjunta");
  for (const [key, value] of Object.entries(overrides)) {
    formData.set(key, value);
  }
  return formData;
}

async function run(formData: FormData): Promise<AccountActionState> {
  return renameAccount({ status: "idle" }, formData);
}

describe("renameAccount (Server Action)", () => {
  it("éxito devuelve el estado con mensaje y revalida el layout", async () => {
    executeMock.mockResolvedValueOnce(undefined);

    const state = await run(buildFormData());

    expect(state).toEqual({ status: "success", message: "Cuenta renombrada" });
    expect(executeMock).toHaveBeenCalledExactlyOnceWith({ id: 3, name: "Cuenta conjunta" });
    expect(revalidatePathMock).toHaveBeenCalledWith("/", "layout");
  });

  it("Zod rechaza el nombre vacío tras trim sin delegar en el caso de uso", async () => {
    const state = await run(buildFormData({ name: "   " }));

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.message).toBe("El nombre de la cuenta es obligatorio.");
      expect(state.values.name).toBe("   ");
    }
    expect(executeMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("Zod rechaza un accountId no numérico sin delegar", async () => {
    const state = await run(buildFormData({ accountId: "xyz" }));

    expect(state.status).toBe("error");
    expect(executeMock).not.toHaveBeenCalled();
  });

  it.each([
    ["InvalidAccountError", "El nombre de la cuenta es obligatorio."],
    ["DuplicateAccountNameError", 'Ya existe una cuenta con el nombre "Cuenta conjunta".'],
    [
      "AccountNotRenamableError",
      "Las cuentas personales no se renombran: su nombre se deduce del miembro.",
    ],
    ["AccountNotFoundError", "La cuenta seleccionada no existe."],
  ])("mapea %s a su mensaje exacto", async (label, message) => {
    const errors = await import("@/domain/account/AccountErrors");
    const error =
      label === "InvalidAccountError"
        ? new errors.InvalidAccountError(message)
        : label === "DuplicateAccountNameError"
          ? new errors.DuplicateAccountNameError("Cuenta conjunta")
          : label === "AccountNotRenamableError"
            ? new errors.AccountNotRenamableError()
            : new errors.AccountNotFoundError();
    executeMock.mockRejectedValueOnce(error);

    const state = await run(buildFormData());

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.message).toBe(message);
    }
  });

  it("mapea cualquier otro DomainError al mensaje genérico de cuenta", async () => {
    const { DomainError } = await import("@/domain/shared/DomainError");
    executeMock.mockRejectedValueOnce(new (class extends DomainError {})("falla inesperada"));

    const state = await run(buildFormData());

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.message).toBe("No se ha podido renombrar la cuenta.");
    }
  });

  it("nunca lanza al cliente ante un error no de dominio", async () => {
    executeMock.mockRejectedValueOnce(new Error("BD caída"));

    const state = await run(buildFormData());

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.message).toBe("No se ha podido renombrar la cuenta.");
    }
  });

  it("ante error conserva el nombre enviado en values", async () => {
    const { DuplicateAccountNameError } = await import("@/domain/account/AccountErrors");
    executeMock.mockRejectedValueOnce(new DuplicateAccountNameError("Cuenta conjunta"));

    const state = await run(buildFormData({ name: "  Cuenta conjunta  " }));

    expect(state).toEqual({
      status: "error",
      message: 'Ya existe una cuenta con el nombre "Cuenta conjunta".',
      values: { name: "  Cuenta conjunta  " },
    });
  });
});
