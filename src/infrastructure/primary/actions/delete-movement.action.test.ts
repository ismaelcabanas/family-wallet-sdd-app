import { describe, expect, it, vi, type Mock } from "vitest";

const { deleteExecuteMock } = vi.hoisted(() => ({ deleteExecuteMock: vi.fn() }));

vi.mock("@/application/movement/DeleteMovement", () => ({
  DeleteMovement: vi.fn().mockImplementation(function () {
    return { execute: deleteExecuteMock };
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/infrastructure/db/client", () => ({ db: {} }));

import {
  deleteMovement,
  type DeleteMovementState,
} from "@/infrastructure/primary/actions/delete-movement.action";

const revalidatePathMock = (await import("next/cache")).revalidatePath as Mock;

function buildFormData(movementId = "7"): FormData {
  const formData = new FormData();
  formData.set("movementId", movementId);
  return formData;
}

async function run(movementId?: string): Promise<DeleteMovementState> {
  return deleteMovement({ status: "idle" }, buildFormData(movementId));
}

describe("deleteMovement (Server Action)", () => {
  it("elimina y devuelve el mensaje de éxito exacto", async () => {
    deleteExecuteMock.mockResolvedValueOnce(undefined);

    const state = await run();

    expect(state).toEqual({ status: "success", message: "Movimiento eliminado" });
    expect(deleteExecuteMock).toHaveBeenCalledExactlyOnceWith(7);
    expect(revalidatePathMock).toHaveBeenCalledExactlyOnceWith("/");
  });

  it.each(["abc", "0", "-1", ""])(`rechaza movementId inválido (%s)`, async (movementId) => {
    const state = await run(movementId);

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.message).toBe("No se ha podido eliminar el movimiento. Inténtalo de nuevo.");
    }
    expect(deleteExecuteMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("mapea MovementNotFoundError al mensaje exacto y revalida la pantalla", async () => {
    const { MovementNotFoundError } = await import("@/domain/movement/MovementErrors");
    deleteExecuteMock.mockRejectedValueOnce(new MovementNotFoundError());

    const state = await run();

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.message).toBe("El movimiento ya no existe.");
    }
    expect(revalidatePathMock).toHaveBeenCalledExactlyOnceWith("/");
  });

  it("mapea una excepción inesperada al mensaje de error del contrato", async () => {
    deleteExecuteMock.mockRejectedValueOnce(new Error("BD caída"));

    const state = await run();

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.message).toBe("No se ha podido eliminar el movimiento. Inténtalo de nuevo.");
    }
  });
});
