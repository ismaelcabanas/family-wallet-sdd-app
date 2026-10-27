import { describe, expect, it, vi, type Mock } from "vitest";

const { configureExecuteMock, deactivateExecuteMock } = vi.hoisted(() => ({
  configureExecuteMock: vi.fn(),
  deactivateExecuteMock: vi.fn(),
}));

vi.mock("@/application/savings/ConfigureSavingsAllocation", () => ({
  ConfigureSavingsAllocation: vi.fn().mockImplementation(function () {
    return { execute: configureExecuteMock };
  }),
}));

vi.mock("@/application/savings/DeactivateSavingsAllocation", () => ({
  DeactivateSavingsAllocation: vi.fn().mockImplementation(function () {
    return { execute: deactivateExecuteMock };
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/infrastructure/db/client", () => ({ db: {} }));

import {
  configureSavingsAllocation,
  type ConfigureSavingsAllocationState,
} from "@/infrastructure/primary/actions/configure-savings-allocation.action";
import { parseIntegerPercentage } from "@/infrastructure/primary/actions/savings-form.schema";
import { currentMonth } from "@/infrastructure/primary/ui/format";

const revalidatePathMock = (await import("next/cache")).revalidatePath as Mock;

function buildFormData(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  formData.set("accountId", "1");
  formData.set("percentage", "10");
  for (const [key, value] of Object.entries(overrides)) {
    if (value === "") {
      formData.delete(key);
    } else {
      formData.set(key, value);
    }
  }
  return formData;
}

async function run(formData: FormData): Promise<ConfigureSavingsAllocationState> {
  return configureSavingsAllocation({ status: "idle" }, formData);
}

describe("parseIntegerPercentage", () => {
  it.each([
    ["10", 10],
    ["100", 100],
    ["1", 1],
  ])("parsea %j → %d", (input, percent) => {
    expect(parseIntegerPercentage(input)).toBe(percent);
  });

  it("«12,5» y «12.5» no son enteros parseables (los rechaza el patrón de la action)", () => {
    expect(Number.isNaN(Number("12,5"))).toBe(true);
    expect(parseIntegerPercentage("12.5")).not.toBe(12);
  });
});

describe("configureSavingsAllocation (Server Action)", () => {
  it("valida y devuelve éxito con intent save por defecto", async () => {
    configureExecuteMock.mockResolvedValueOnce({
      accountId: 1,
      percentage: 10,
      active: true,
      activatedAtMonth: currentMonth(),
    });

    const state = await run(buildFormData());

    expect(state).toEqual({ status: "success", message: "Ahorro guardado" });
    expect(configureExecuteMock).toHaveBeenCalledExactlyOnceWith({
      accountId: 1,
      percentage: 10,
      currentMonth: currentMonth(),
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/", "layout");
    expect(deactivateExecuteMock).not.toHaveBeenCalled();
  });

  it.each([
    ["", "El porcentaje es obligatorio."],
    ["abc", "Introduce un porcentaje entero entre 1 y 100 (ej. 10)."],
    ["12,5", "Introduce un porcentaje entero entre 1 y 100 (ej. 10)."],
    ["12.5", "Introduce un porcentaje entero entre 1 y 100 (ej. 10)."],
    ["-5", "Introduce un porcentaje entero entre 1 y 100 (ej. 10)."],
    ["10%", "Introduce un porcentaje entero entre 1 y 100 (ej. 10)."],
    ["1000", "Introduce un porcentaje entero entre 1 y 100 (ej. 10)."],
    ["0", "El porcentaje debe ser mayor que cero."],
    ["101", "El porcentaje no puede ser mayor que 100."],
  ])("rechaza el porcentaje %j con su mensaje exacto", async (percentage, message) => {
    const state = await run(buildFormData({ percentage }));

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.errors.percentage).toEqual([message]);
    }
    expect(configureExecuteMock).not.toHaveBeenCalled();
  });

  it("conserva el valor introducido tras un fallo", async () => {
    const state = await run(buildFormData({ percentage: "abc" }));

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.values).toEqual({ percentage: "abc" });
    }
  });

  it("nada se persiste ni revalida cuando la validación falla", async () => {
    await run(buildFormData({ percentage: "" }));

    expect(configureExecuteMock).not.toHaveBeenCalled();
    expect(deactivateExecuteMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("intent=deactivate valida solo accountId y delega en DeactivateSavingsAllocation", async () => {
    deactivateExecuteMock.mockResolvedValueOnce({
      accountId: 1,
      percentage: 10,
      active: false,
      activatedAtMonth: "2026-08",
    });

    const state = await run(buildFormData({ intent: "deactivate", percentage: "" }));

    expect(state).toEqual({ status: "success", message: "Ahorro desactivado" });
    expect(deactivateExecuteMock).toHaveBeenCalledExactlyOnceWith(1);
    expect(configureExecuteMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith("/", "layout");
  });

  it("accountId inválido cae en error de formulario genérico", async () => {
    const state = await run(buildFormData({ accountId: "abc" }));

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.errors._form).toEqual(["No se ha podido guardar el ahorro. Inténtalo de nuevo."]);
    }
    expect(configureExecuteMock).not.toHaveBeenCalled();
  });

  it("mapea InvalidSavingsAllocationError a su campo", async () => {
    const { InvalidSavingsAllocationError } = await import(
      "@/domain/savings/SavingsAllocationErrors"
    );
    configureExecuteMock.mockRejectedValueOnce(
      new InvalidSavingsAllocationError(
        "percentage",
        "El porcentaje aplicado a tu ingreso regular debe resultar en al menos 0,01 €.",
      ),
    );

    const state = await run(buildFormData());

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.errors.percentage).toEqual([
        "El porcentaje aplicado a tu ingreso regular debe resultar en al menos 0,01 €.",
      ]);
    }
  });

  it("mapea MissingRegularIncomeError al formulario con su literal", async () => {
    const { MissingRegularIncomeError } = await import(
      "@/domain/savings/SavingsAllocationErrors"
    );
    configureExecuteMock.mockRejectedValueOnce(new MissingRegularIncomeError());

    const state = await run(buildFormData());

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.errors._form).toEqual([
        "Configura primero el ingreso regular de este miembro.",
      ]);
    }
  });

  it("mapea SharedAccountSavingsError al formulario con su literal", async () => {
    const { SharedAccountSavingsError } = await import(
      "@/domain/savings/SavingsAllocationErrors"
    );
    configureExecuteMock.mockRejectedValueOnce(new SharedAccountSavingsError());

    const state = await run(buildFormData());

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.errors._form).toEqual(["La cuenta común no puede tener ahorro."]);
    }
  });

  it("mapea SavingsAllocationNotFoundError al formulario con su literal", async () => {
    const { SavingsAllocationNotFoundError } = await import(
      "@/domain/savings/SavingsAllocationErrors"
    );
    deactivateExecuteMock.mockRejectedValueOnce(new SavingsAllocationNotFoundError());

    const state = await run(buildFormData({ intent: "deactivate" }));

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.errors._form).toEqual(["No existe ahorro configurado para esta cuenta."]);
    }
  });

  it("mapea una excepción inesperada a error de formulario genérico", async () => {
    configureExecuteMock.mockRejectedValueOnce(new Error("BD caída"));

    const state = await run(buildFormData());

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.errors._form).toEqual([
        "No se ha podido guardar el ahorro. Inténtalo de nuevo.",
      ]);
    }
  });
});
