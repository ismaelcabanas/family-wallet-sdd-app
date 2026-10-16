import { describe, expect, it, vi, type Mock } from "vitest";

const { configureExecuteMock, deactivateExecuteMock } = vi.hoisted(() => ({
  configureExecuteMock: vi.fn(),
  deactivateExecuteMock: vi.fn(),
}));

vi.mock("@/application/common-contribution/ConfigureCommonContribution", () => ({
  ConfigureCommonContribution: vi.fn().mockImplementation(function () {
    return { execute: configureExecuteMock };
  }),
}));

vi.mock("@/application/common-contribution/DeactivateCommonContribution", () => ({
  DeactivateCommonContribution: vi.fn().mockImplementation(function () {
    return { execute: deactivateExecuteMock };
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/infrastructure/db/client", () => ({ db: {} }));

import {
  configureCommonContribution,
  type ConfigureCommonContributionState,
} from "@/infrastructure/primary/actions/configure-common-contribution.action";
import { parsePercentageToBasisPoints } from "@/infrastructure/primary/actions/contribution-form.schema";
import { currentMonth } from "@/infrastructure/primary/ui/format";

const revalidatePathMock = (await import("next/cache")).revalidatePath as Mock;

function buildFormData(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  formData.set("accountId", "1");
  formData.set("percentage", "25");
  for (const [key, value] of Object.entries(overrides)) {
    if (value === "") {
      formData.delete(key);
    } else {
      formData.set(key, value);
    }
  }
  return formData;
}

async function run(formData: FormData): Promise<ConfigureCommonContributionState> {
  return configureCommonContribution({ status: "idle" }, formData);
}

describe("parsePercentageToBasisPoints", () => {
  it.each([
    ["25", 2500],
    ["25,0", 2500],
    ["25.00", 2500],
    ["12,5", 1250],
    ["33,33", 3333],
    ["100", 10_000],
    ["0,01", 1],
  ])("parsea %j → %d bp", (input, basisPoints) => {
    expect(parsePercentageToBasisPoints(input)).toBe(basisPoints);
  });
});

describe("configureCommonContribution (Server Action)", () => {
  it("valida y devuelve éxito con intent save por defecto", async () => {
    configureExecuteMock.mockResolvedValueOnce({
      accountId: 1,
      percentageBasisPoints: 2500,
      active: true,
      activatedAtMonth: currentMonth(),
    });

    const state = await run(buildFormData());

    expect(state).toEqual({ status: "success", message: "Aportación guardada" });
    expect(configureExecuteMock).toHaveBeenCalledExactlyOnceWith({
      accountId: 1,
      percentageBasisPoints: 2500,
      currentMonth: currentMonth(),
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/", "layout");
    expect(deactivateExecuteMock).not.toHaveBeenCalled();
  });

  it.each([
    ["", "El porcentaje es obligatorio."],
    ["abc", "Introduce un porcentaje válido (ej. 25 o 12,5)."],
    ["-5", "Introduce un porcentaje válido (ej. 25 o 12,5)."],
    ["12,345", "Introduce un porcentaje válido (ej. 25 o 12,5)."],
    ["25%", "Introduce un porcentaje válido (ej. 25 o 12,5)."],
    ["0", "El porcentaje debe ser mayor que cero."],
    ["0,00", "El porcentaje debe ser mayor que cero."],
    ["100,01", "El porcentaje no puede ser mayor que 100."],
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

  it("intent=deactivate valida solo accountId y delega en DeactivateCommonContribution", async () => {
    deactivateExecuteMock.mockResolvedValueOnce({
      accountId: 1,
      percentageBasisPoints: 2500,
      active: false,
      activatedAtMonth: "2026-08",
    });

    const state = await run(buildFormData({ intent: "deactivate", percentage: "" }));

    expect(state).toEqual({ status: "success", message: "Aportación desactivada" });
    expect(deactivateExecuteMock).toHaveBeenCalledExactlyOnceWith(1);
    expect(configureExecuteMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith("/", "layout");
  });

  it("accountId inválido cae en error de formulario genérico", async () => {
    const state = await run(buildFormData({ accountId: "abc" }));

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.errors._form).toEqual(["No se ha podido guardar la aportación. Inténtalo de nuevo."]);
    }
    expect(configureExecuteMock).not.toHaveBeenCalled();
  });

  it("mapea InvalidCommonContributionError a su campo", async () => {
    const { InvalidCommonContributionError } = await import(
      "@/domain/common-contribution/CommonContributionErrors"
    );
    configureExecuteMock.mockRejectedValueOnce(
      new InvalidCommonContributionError(
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
      "@/domain/common-contribution/CommonContributionErrors"
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

  it("mapea SharedAccountContributionError al formulario con su literal", async () => {
    const { SharedAccountContributionError } = await import(
      "@/domain/common-contribution/CommonContributionErrors"
    );
    configureExecuteMock.mockRejectedValueOnce(new SharedAccountContributionError());

    const state = await run(buildFormData());

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.errors._form).toEqual(["La cuenta común no puede tener aportación."]);
    }
  });

  it("mapea CommonContributionNotFoundError al formulario con su literal", async () => {
    const { CommonContributionNotFoundError } = await import(
      "@/domain/common-contribution/CommonContributionErrors"
    );
    deactivateExecuteMock.mockRejectedValueOnce(new CommonContributionNotFoundError());

    const state = await run(buildFormData({ intent: "deactivate" }));

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.errors._form).toEqual(["No existe aportación configurada para esta cuenta."]);
    }
  });

  it("mapea una excepción inesperada a error de formulario genérico", async () => {
    configureExecuteMock.mockRejectedValueOnce(new Error("BD caída"));

    const state = await run(buildFormData());

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.errors._form).toEqual([
        "No se ha podido guardar la aportación. Inténtalo de nuevo.",
      ]);
    }
  });
});
