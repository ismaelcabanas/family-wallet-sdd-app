import { describe, expect, it, vi, type Mock } from "vitest";

const { configureExecuteMock, deactivateExecuteMock } = vi.hoisted(() => ({
  configureExecuteMock: vi.fn(),
  deactivateExecuteMock: vi.fn(),
}));

vi.mock("@/application/regular-income/ConfigureRegularIncome", () => ({
  ConfigureRegularIncome: vi.fn().mockImplementation(function () {
    return { execute: configureExecuteMock };
  }),
}));

vi.mock("@/application/regular-income/DeactivateRegularIncome", () => ({
  DeactivateRegularIncome: vi.fn().mockImplementation(function () {
    return { execute: deactivateExecuteMock };
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/infrastructure/db/client", () => ({ db: {} }));

import {
  configureRegularIncome,
  type ConfigureRegularIncomeState,
} from "@/infrastructure/primary/actions/configure-regular-income.action";
import { currentMonth } from "@/infrastructure/primary/ui/format";

const revalidatePathMock = (await import("next/cache")).revalidatePath as Mock;

function buildFormData(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  formData.set("accountId", "1");
  formData.set("amount", "2000,00");
  formData.set("dayOfMonth", "1");
  formData.set("note", "");
  for (const [key, value] of Object.entries(overrides)) {
    if (value === "") {
      formData.delete(key);
    } else {
      formData.set(key, value);
    }
  }
  return formData;
}

async function run(formData: FormData): Promise<ConfigureRegularIncomeState> {
  return configureRegularIncome({ status: "idle" }, formData);
}

describe("configureRegularIncome (Server Action)", () => {
  it("valida y devuelve éxito con intent save por defecto", async () => {
    configureExecuteMock.mockResolvedValueOnce({
      accountId: 1,
      amountCents: 200_000,
      dayOfMonth: 1,
      note: "Ingreso regular de Miembro A",
      active: true,
      activatedAtMonth: currentMonth(),
    });

    const state = await run(buildFormData());

    expect(state).toEqual({ status: "success", message: "Ingreso regular guardado" });
    expect(configureExecuteMock).toHaveBeenCalledExactlyOnceWith({
      accountId: 1,
      amountCents: 200_000,
      dayOfMonth: 1,
      note: null,
      currentMonth: currentMonth(),
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/", "layout");
    expect(deactivateExecuteMock).not.toHaveBeenCalled();
  });

  it("acepta importe con un decimal rellenado a dos (2000,5 → 2000,50)", async () => {
    configureExecuteMock.mockResolvedValueOnce(null);

    await run(buildFormData({ amount: "2000,5" }));

    expect(configureExecuteMock.mock.calls[0][0].amountCents).toBe(200_050);
  });

  it("el día vacío aplica el default 1", async () => {
    configureExecuteMock.mockResolvedValueOnce(null);

    await run(buildFormData({ dayOfMonth: "" }));

    expect(configureExecuteMock.mock.calls[0][0].dayOfMonth).toBe(1);
  });

  it("conserva la nota explícita", async () => {
    configureExecuteMock.mockResolvedValueOnce(null);

    await run(buildFormData({ note: "Nómina" }));

    expect(configureExecuteMock.mock.calls[0][0].note).toBe("Nómina");
  });

  it.each([
    ["", "El importe es obligatorio."],
    ["abc", "Introduce un importe válido (ej. 2000,00)."],
    ["-5", "Introduce un importe válido (ej. 2000,00)."],
    ["1.234,56", "Introduce un importe válido (ej. 2000,00)."],
    ["2000,005", "Introduce un importe válido (ej. 2000,00)."],
    ["0", "El importe debe ser mayor que cero."],
    ["0,00", "El importe debe ser mayor que cero."],
  ])("rechaza el importe %j con su mensaje exacto", async (amount, message) => {
    const state = await run(buildFormData({ amount }));

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.errors.amount).toEqual([message]);
    }
    expect(configureExecuteMock).not.toHaveBeenCalled();
  });

  it.each([
    ["0"],
    ["32"],
    ["abc"],
  ])("rechaza el día %j con el mensaje del contrato", async (dayOfMonth) => {
    const state = await run(buildFormData({ dayOfMonth }));

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.errors.dayOfMonth).toEqual(["El día del mes debe estar entre 1 y 31."]);
    }
    expect(configureExecuteMock).not.toHaveBeenCalled();
  });

  it("acepta los días límite 1 y 31", async () => {
    configureExecuteMock.mockResolvedValue(null);

    await run(buildFormData({ dayOfMonth: "31" }));

    expect(configureExecuteMock.mock.calls[0][0].dayOfMonth).toBe(31);
  });

  it("conserva los valores introducidos tras un fallo", async () => {
    const state = await run(buildFormData({ amount: "abc", dayOfMonth: "15", note: "Nómina" }));

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.values).toEqual({ amount: "abc", dayOfMonth: "15", note: "Nómina" });
    }
  });

  it("nada se persiste ni revalida cuando la validación falla", async () => {
    await run(buildFormData({ amount: "" }));

    expect(configureExecuteMock).not.toHaveBeenCalled();
    expect(deactivateExecuteMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("intent=deactivate valida solo accountId y delega en DeactivateRegularIncome", async () => {
    deactivateExecuteMock.mockResolvedValueOnce({
      accountId: 1,
      amountCents: 200_000,
      dayOfMonth: 1,
      note: "Ingreso regular de Miembro A",
      active: false,
      activatedAtMonth: "2026-08",
    });

    const state = await run(
      buildFormData({ intent: "deactivate", amount: "", dayOfMonth: "", note: "" }),
    );

    expect(state).toEqual({ status: "success", message: "Ingreso regular desactivado" });
    expect(deactivateExecuteMock).toHaveBeenCalledExactlyOnceWith(1);
    expect(configureExecuteMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith("/", "layout");
  });

  it("mapea InvalidMoneyError al campo amount", async () => {
    const { InvalidMoneyError } = await import("@/domain/movement/MovementErrors");
    configureExecuteMock.mockRejectedValueOnce(new InvalidMoneyError("El importe es mayor que cero."));

    const state = await run(buildFormData());

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.errors.amount).toEqual(["El importe es mayor que cero."]);
    }
  });

  it("mapea InvalidRegularIncomeError a su campo", async () => {
    const { InvalidRegularIncomeError } = await import(
      "@/domain/regular-income/RegularIncomeErrors"
    );
    configureExecuteMock.mockRejectedValueOnce(
      new InvalidRegularIncomeError("dayOfMonth", "El día del mes debe estar entre 1 y 31."),
    );

    const state = await run(buildFormData());

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.errors.dayOfMonth).toEqual(["El día del mes debe estar entre 1 y 31."]);
    }
  });

  it("mapea SharedAccountIncomeError al formulario con su literal", async () => {
    const { SharedAccountIncomeError } = await import(
      "@/domain/regular-income/RegularIncomeErrors"
    );
    configureExecuteMock.mockRejectedValueOnce(new SharedAccountIncomeError());

    const state = await run(buildFormData());

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.errors._form).toEqual(["La cuenta común no puede tener ingreso regular."]);
    }
  });

  it("mapea una excepción inesperada a error de formulario genérico", async () => {
    configureExecuteMock.mockRejectedValueOnce(new Error("BD caída"));

    const state = await run(buildFormData());

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.errors._form).toEqual([
        "No se ha podido guardar el ingreso regular. Inténtalo de nuevo.",
      ]);
    }
  });
});
