import type { AccountDTO } from "@/application/movement/dto";
import type { SheetImportPreviewDTO } from "@/application/import/dto";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/infrastructure/primary/actions/import-sheet.action", () => ({
  importSheetAction: vi.fn(),
}));

import { importSheetAction } from "@/infrastructure/primary/actions/import-sheet.action";
import { ImportSheetWizard } from "@/infrastructure/primary/ui/import-sheet-wizard";
import { formatAmountCents, monthLabel } from "@/infrastructure/primary/ui/format";

const actionMock = importSheetAction as unknown as Mock;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const SPACE_CLASS = "[\\s\\u00A0\\u202F]";

function toExactRe(text: string): RegExp {
  const escaped = escapeRegExp(text).replace(/\s/g, SPACE_CLASS);
  return new RegExp(`^${escaped}$`);
}

function lineRe(label: string, cents: number): RegExp {
  return toExactRe(`${label}: ${formatAmountCents(cents)}`);
}

const ACCOUNTS: AccountDTO[] = [
  {
    id: 1,
    name: "Cuenta de Miembro A",
    type: "personal",
    memberId: 1,
    memberName: "Miembro A",
  },
  { id: 3, name: "Cuenta común", type: "shared", memberId: null, memberName: null },
];

const MONTHS = ["2025-12", "2026-01", "2026-02"];

const PREVIEW: SheetImportPreviewDTO = {
  accountName: "Cuenta de Miembro A",
  month: "2026-01",
  rows: [
    {
      line: 2,
      status: "ok",
      movement: {
        date: "2026-01-01",
        note: "Regalo — Cumple David",
        amountCents: 5000,
        type: "expense",
        nature: "personal",
        tagName: "Ocio",
        createsTag: false,
      },
    },
    {
      line: 3,
      status: "ok",
      movement: {
        date: "2026-01-01",
        note: "Nomina",
        amountCents: 330000,
        type: "income",
        nature: null,
        tagName: null,
        createsTag: false,
      },
    },
    {
      line: 4,
      status: "ok",
      movement: {
        date: "2026-01-01",
        note: "Pienso",
        amountCents: 1865,
        type: "expense",
        nature: "personal",
        tagName: "Mascotas",
        createsTag: true,
      },
    },
    { line: 34, status: "ignored", reason: "fila de configuración de la hoja" },
    { line: 35, status: "error", reason: 'El importe "abc" no tiene un formato válido (usa punto decimal y hasta dos decimales).' },
  ],
  totals: {
    movements: 13,
    personalExpenseCents: 18675,
    sharedExpenseCents: 7352,
    incomeCents: 330000,
    ignored: 1,
    errors: 1,
  },
  tagsToCreate: ["Mascotas"],
};

const CSV = new File(["cabecera\r\n"], "enero.csv", { type: "text/csv" });

async function fillStepOne(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("combobox", { name: "Cuenta" }));
  await user.click(screen.getByRole("option", { name: "Cuenta de Miembro A" }));
  await user.click(screen.getByRole("combobox", { name: "Mes" }));
  await user.click(screen.getByRole("option", { name: "Enero de 2026" }));
  await user.upload(screen.getByLabelText("Fichero CSV"), CSV);
}

function renderWizard() {
  render(<ImportSheetWizard accounts={ACCOUNTS} months={MONTHS} />);
}

afterEach(() => {
  cleanup();
  actionMock.mockReset();
});

describe("ImportSheetWizard — paso 1: selección", () => {
  it("muestra los tres controles y «Previsualizar importación» deshabilitado hasta tener cuenta, mes y fichero", async () => {
    const user = userEvent.setup();
    renderWizard();

    const previewButton = screen.getByRole("button", { name: "Previsualizar importación" });
    expect(previewButton).toBeDisabled();

    await user.click(screen.getByRole("combobox", { name: "Cuenta" }));
    await user.click(screen.getByRole("option", { name: "Cuenta de Miembro A" }));
    expect(previewButton).toBeDisabled();

    await user.click(screen.getByRole("combobox", { name: "Mes" }));
    await user.click(screen.getByRole("option", { name: "Enero de 2026" }));
    expect(previewButton).toBeDisabled();

    await user.upload(screen.getByLabelText("Fichero CSV"), CSV);
    expect(previewButton).toBeEnabled();
  });

  it("muestra «Previsualizando…» en curso mientras corre la action", async () => {
    const user = userEvent.setup();
    renderWizard();
    await fillStepOne(user);

    let resolveAction: (value: unknown) => void = () => {};
    actionMock.mockReturnValueOnce(new Promise((resolve) => (resolveAction = resolve)));

    await user.click(screen.getByRole("button", { name: "Previsualizar importación" }));

    expect(screen.getByRole("button", { name: "Previsualizando…" })).toBeDisabled();
    resolveAction({ status: "idle" });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Previsualizar importación" })).toBeEnabled(),
    );
  });

  it("error de action → role=alert bajo el formulario sin salir del paso 1", async () => {
    const user = userEvent.setup();
    renderWizard();
    await fillStepOne(user);
    actionMock.mockResolvedValueOnce({
      status: "error",
      message:
        "La estructura del fichero no coincide con la esperada (cabecera de 13 columnas de la hoja mensual).",
    });

    await user.click(screen.getByRole("button", { name: "Previsualizar importación" }));

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("La estructura del fichero no coincide");
    expect(
      screen.getByRole("button", { name: "Previsualizar importación" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Resumen de la importación" })).toBeNull();
  });
});

describe("ImportSheetWizard — paso 2: previsualización", () => {
  async function reachPreview(user: ReturnType<typeof userEvent.setup>) {
    actionMock.mockResolvedValueOnce({ status: "preview", preview: PREVIEW });
    await fillStepOne(user);
    await user.click(screen.getByRole("button", { name: "Previsualizar importación" }));
    await screen.findByRole("region", { name: "Resumen de la importación" });
  }

  it("renderiza resumen con totales, regiones de etiquetas/ignoradas/errores y tabla de movimientos", async () => {
    const user = userEvent.setup();
    renderWizard();
    await reachPreview(user);

    expect(
      screen.getByText("13 movimientos para Cuenta de Miembro A · Enero de 2026"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        lineRe("Gastos personales", 18675),
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(lineRe("Gastos compartidos", 7352))).toBeInTheDocument();
    expect(screen.getByText(lineRe("Ingresos", 330000))).toBeInTheDocument();

    const tagsRegion = screen.getByRole("region", { name: "Etiquetas que se crearán" });
    expect(within(tagsRegion).getByText("Mascotas")).toBeInTheDocument();

    const ignoredRegion = screen.getByRole("region", { name: "Filas ignoradas" });
    expect(
      within(ignoredRegion).getByText("Fila 34: fila de configuración de la hoja"),
    ).toBeInTheDocument();

    const errorsRegion = screen.getByRole("alert", { name: "Filas con error" });
    expect(within(errorsRegion).getByText(/El importe "abc"/)).toBeInTheDocument();

    const table = screen.getByRole("table", { name: "Movimientos detectados" });
    expect(within(table).getByText("Regalo — Cumple David")).toBeInTheDocument();
    expect(within(table).getByText("Nomina")).toBeInTheDocument();
    expect(within(table).getByText("Mascotas (nueva)")).toBeInTheDocument();
    expect(within(table).getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });

  it("«Confirmar importación (N movimientos)» deshabilitado con errores (SC-003)", async () => {
    const user = userEvent.setup();
    renderWizard();
    await reachPreview(user);

    expect(
      screen.getByRole("button", { name: "Confirmar importación (13 movimientos)" }),
    ).toBeDisabled();
  });

  it("sin errores y con movimientos → confirmar habilitado; sin etiquetas nuevas muestra «Ninguna etiqueta nueva.»", async () => {
    const user = userEvent.setup();
    renderWizard();
    const cleanPreview: SheetImportPreviewDTO = {
      ...PREVIEW,
      rows: PREVIEW.rows.filter((row) => row.status === "ok"),
      totals: { ...PREVIEW.totals, ignored: 0, errors: 0 },
      tagsToCreate: [],
    };
    actionMock.mockResolvedValueOnce({ status: "preview", preview: cleanPreview });
    await fillStepOne(user);
    await user.click(screen.getByRole("button", { name: "Previsualizar importación" }));
    await screen.findByRole("region", { name: "Resumen de la importación" });

    expect(
      screen.getByRole("button", { name: "Confirmar importación (13 movimientos)" }),
    ).toBeEnabled();
    expect(screen.getByText("Ninguna etiqueta nueva.")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Filas ignoradas" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Filas con error" })).toBeNull();
  });

  it("cambiar la cuenta tras previsualizar descarta la previsualización y vuelve al paso 1", async () => {
    const user = userEvent.setup();
    renderWizard();
    await reachPreview(user);

    await user.click(screen.getByRole("combobox", { name: "Cuenta" }));
    await user.click(screen.getByRole("option", { name: "Cuenta común" }));

    expect(screen.queryByRole("region", { name: "Resumen de la importación" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Previsualizar importación" }),
    ).toBeInTheDocument();
  });

  it("cambiar el fichero tras previsualizar también invalida", async () => {
    const user = userEvent.setup();
    renderWizard();
    await reachPreview(user);

    await user.upload(screen.getByLabelText("Fichero CSV"), new File(["otro\r\n"], "otro.csv"));

    expect(screen.queryByRole("region", { name: "Resumen de la importación" })).toBeNull();
  });
});

describe("ImportSheetWizard — confirmación y éxito", () => {
  async function reachCleanPreview(user: ReturnType<typeof userEvent.setup>) {
    const cleanPreview: SheetImportPreviewDTO = {
      ...PREVIEW,
      rows: PREVIEW.rows.filter((row) => row.status === "ok"),
      totals: { ...PREVIEW.totals, ignored: 0, errors: 0 },
    };
    actionMock.mockResolvedValueOnce({ status: "preview", preview: cleanPreview });
    await fillStepOne(user);
    await user.click(screen.getByRole("button", { name: "Previsualizar importación" }));
    await screen.findByRole("region", { name: "Resumen de la importación" });
  }

  it("confirmar en éxito → «Importación completada» con etiquetas y enlace a la cuenta", async () => {
    const user = userEvent.setup();
    renderWizard();
    await reachCleanPreview(user);
    actionMock.mockResolvedValueOnce({
      status: "imported",
      movementsCreated: 13,
      tagsCreated: 1,
      accountId: 1,
      month: "2026-01",
    });

    await user.click(screen.getByRole("button", { name: "Confirmar importación (13 movimientos)" }));
    await screen.findByText("Importación completada: 13 movimientos · 1 etiqueta creada");

    const link = screen.getByRole("link", {
      name: `Ver los movimientos en Cuenta de Miembro A · ${monthLabel("2026-01")}`,
    });
    expect(link).toHaveAttribute("href", "/accounts/1?month=2026-01");
  });

  it("confirmar con error de action → alerta y vuelta al paso 1 (previsualización invalidada)", async () => {
    const user = userEvent.setup();
    renderWizard();
    await reachCleanPreview(user);
    actionMock.mockResolvedValueOnce({
      status: "error",
      message:
        "La previsualización ya no es válida (p. ej. una etiqueta ha cambiado). Revisa el fichero y vuelve a previsualizarlo.",
    });

    await user.click(screen.getByRole("button", { name: "Confirmar importación (13 movimientos)" }));
    const alert = await screen.findByRole("alert");

    expect(alert).toHaveTextContent("La previsualización ya no es válida");
    expect(screen.queryByRole("region", { name: "Resumen de la importación" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Previsualizar importación" }),
    ).toBeInTheDocument();
  });

  it("«Volver» descarta la previsualización y regresa al paso 1", async () => {
    const user = userEvent.setup();
    renderWizard();
    await reachCleanPreview(user);

    await user.click(screen.getByRole("button", { name: "Volver" }));

    expect(screen.queryByRole("region", { name: "Resumen de la importación" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Previsualizar importación" }),
    ).toBeInTheDocument();
  });
});
