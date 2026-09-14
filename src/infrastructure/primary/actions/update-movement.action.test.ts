import { describe, expect, it, vi, type Mock } from "vitest";

const { updateExecuteMock, listAccountsExecuteMock } = vi.hoisted(() => ({
  updateExecuteMock: vi.fn(),
  listAccountsExecuteMock: vi.fn(),
}));

vi.mock("@/application/movement/UpdateMovement", () => ({
  UpdateMovement: vi.fn().mockImplementation(function () {
    return { execute: updateExecuteMock };
  }),
}));

vi.mock("@/application/account/ListAccounts", () => ({
  ListAccounts: vi.fn().mockImplementation(function () {
    return { execute: listAccountsExecuteMock };
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/infrastructure/db/client", () => ({ db: {} }));

import {
  updateMovement,
  type UpdateMovementState,
} from "@/infrastructure/primary/actions/update-movement.action";

const revalidatePathMock = (await import("next/cache")).revalidatePath as Mock;

const ACCOUNTS = [
  { id: 1, name: "Cuenta de Miembro A", type: "personal" as const, memberName: "Miembro A" },
  { id: 3, name: "Cuenta común", type: "shared" as const, memberName: null },
];

function buildFormData(overrides: Record<string, string | string[]> = {}): FormData {
  const formData = new FormData();
  formData.set("movementId", "7");
  formData.set("date", "2026-09-10");
  formData.set("concept", "Mercadona");
  formData.set("description", "");
  formData.set("amount", "78,50");
  formData.set("accountId", "1");
  formData.set("type", "expense");
  formData.set("nature", "personal");
  formData.append("tagIds", "2");
  formData.append("tagIds", "3");
  formData.set("currentAccountId", "1");
  formData.set("currentMonth", "2026-09");
  for (const [key, value] of Object.entries(overrides)) {
    formData.delete(key);
    if (Array.isArray(value)) {
      for (const item of value) formData.append(key, item);
    } else if (value !== "") {
      formData.set(key, value);
    }
  }
  return formData;
}

async function run(formData: FormData): Promise<UpdateMovementState> {
  return updateMovement({ status: "idle" }, formData);
}

describe("updateMovement (Server Action)", () => {
  it("valida, edita y devuelve éxito visible en la vista actual", async () => {
    updateExecuteMock.mockResolvedValueOnce(undefined);
    listAccountsExecuteMock.mockResolvedValueOnce(ACCOUNTS);

    const state = await run(buildFormData());

    expect(state).toEqual({ status: "success", message: "Movimiento actualizado" });
    expect(updateExecuteMock).toHaveBeenCalledExactlyOnceWith({
      movementId: 7,
      accountId: 1,
      type: "expense",
      date: "2026-09-10",
      concept: "Mercadona",
      description: null,
      amountCents: 7_850,
      nature: "personal",
      tagIds: [2, 3],
    });
    expect(revalidatePathMock).toHaveBeenCalledExactlyOnceWith("/");
  });

  it("compone el aviso de mes movido (misma cuenta)", async () => {
    updateExecuteMock.mockResolvedValueOnce(undefined);
    listAccountsExecuteMock.mockResolvedValueOnce(ACCOUNTS);

    const state = await run(buildFormData({ date: "2026-08-15" }));

    expect(state).toEqual({
      status: "success",
      message: "Movimiento actualizado: ahora está en Agosto 2026",
    });
  });

  it("compone el aviso de cuenta movida (mismo mes)", async () => {
    updateExecuteMock.mockResolvedValueOnce(undefined);
    listAccountsExecuteMock.mockResolvedValueOnce(ACCOUNTS);

    const state = await run(buildFormData({ accountId: "3", nature: "shared" }));

    expect(state).toEqual({
      status: "success",
      message: "Movimiento actualizado: ahora está en Cuenta común",
    });
  });

  it("compone el aviso de cuenta y mes movidos", async () => {
    updateExecuteMock.mockResolvedValueOnce(undefined);
    listAccountsExecuteMock.mockResolvedValueOnce(ACCOUNTS);

    const state = await run(
      buildFormData({ accountId: "3", nature: "shared", date: "2026-08-15" }),
    );

    expect(state).toEqual({
      status: "success",
      message: "Movimiento actualizado: ahora está en Cuenta común · Agosto 2026",
    });
  });

  it.each([
    ["movementId", "abc"],
    ["movementId", "0"],
    ["currentAccountId", "abc"],
    ["currentMonth", "sep-2026"],
    ["currentMonth", "2026-13"],
  ])("rechaza %s inválido (%s) como error de formulario", async (field, value) => {
    const state = await run(buildFormData({ [field]: value }));

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.errors._form).toEqual([
        "No se ha podido guardar el movimiento. Inténtalo de nuevo.",
      ]);
    }
    expect(updateExecuteMock).not.toHaveBeenCalled();
  });

  it("rechaza el importe inválido con los mismos mensajes que el alta (FR-002)", async () => {
    const state = await run(buildFormData({ amount: "abc" }));

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.errors.amount).toEqual(["Introduce un importe válido (ej. 850,00)."]);
    }
    expect(updateExecuteMock).not.toHaveBeenCalled();
  });

  it("conserva los valores introducidos tras un error de campo", async () => {
    const state = await run(buildFormData({ concept: "" }));

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.values.concept).toBe("");
      expect(state.values.amount).toBe("78,50");
    }
  });

  it("mapea MovementNotFoundError al mensaje exacto y revalida la pantalla", async () => {
    const { MovementNotFoundError } = await import("@/domain/movement/MovementErrors");
    updateExecuteMock.mockRejectedValueOnce(new MovementNotFoundError());
    listAccountsExecuteMock.mockResolvedValueOnce(ACCOUNTS);

    const state = await run(buildFormData());

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.errors._form).toEqual(["El movimiento ya no existe."]);
    }
    expect(revalidatePathMock).toHaveBeenCalledExactlyOnceWith("/");
  });

  it("mapea una excepción inesperada a error de formulario", async () => {
    updateExecuteMock.mockRejectedValueOnce(new Error("BD caída"));
    listAccountsExecuteMock.mockResolvedValueOnce(ACCOUNTS);

    const state = await run(buildFormData());

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.errors._form).toEqual([
        "No se ha podido guardar el movimiento. Inténtalo de nuevo.",
      ]);
    }
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
