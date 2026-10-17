import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { reactivateMock, toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
  reactivateMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("../actions/reactivate-tag.action", () => ({
  reactivateTag: reactivateMock,
}));

vi.mock("sonner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("sonner")>();
  return {
    ...actual,
    toast: { ...actual.toast, success: toastSuccessMock, error: toastErrorMock },
  };
});

import type { CatalogTagDTO } from "@/application/tag/dto";
import { TagCatalog } from "./tag-catalog";

const TAGS: CatalogTagDTO[] = [
  { id: 1, name: "Alimentación", slug: "alimentacion", status: "active", isProtected: false },
  { id: 100, name: "Aportación Común", slug: "aportacion-comun", status: "active", isProtected: true },
  { id: 3, name: "Zapatos", slug: "zapatos", status: "inactive", isProtected: false },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TagCatalog", () => {
  it("renderiza la región del catálogo con una fila listitem por etiqueta y su chip de estado", () => {
    render(<TagCatalog tags={TAGS} />);

    const region = screen.getByRole("region", { name: "Catálogo de etiquetas" });
    const items = within(region).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Alimentación");
    expect(items[0]).toHaveTextContent("Activa");
    expect(items[2]).toHaveTextContent("Zapatos");
    expect(items[2]).toHaveTextContent("Inactiva");
  });

  it("muestra el distintivo Sistema en la fila protegida y sin botón de acciones", () => {
    render(<TagCatalog tags={TAGS} />);

    const protectedRow = screen.getByRole("listitem", { name: /Aportación Común/ });
    expect(protectedRow).toHaveTextContent("Sistema");
    expect(
      within(protectedRow).queryByRole("button", { name: "Acciones de Aportación Común" }),
    ).not.toBeInTheDocument();
  });

  it("la fila activa no protegida ofrece Renombrar…, Fusionar en otra… y Desactivar…", async () => {
    const user = userEvent.setup();
    render(<TagCatalog tags={TAGS} />);

    await user.click(
      screen.getByRole("button", { name: "Acciones de Alimentación" }),
    );

    const menu = screen.getByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Renombrar…" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Fusionar en otra…" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Desactivar…" })).toBeInTheDocument();
  });

  it("«Renombrar…» abre el diálogo de renombrado con el DTO capturado", async () => {
    const user = userEvent.setup();
    render(<TagCatalog tags={TAGS} />);

    await user.click(screen.getByRole("button", { name: "Acciones de Alimentación" }));
    await user.click(screen.getByRole("menuitem", { name: "Renombrar…" }));

    const dialog = screen.getByRole("dialog", { name: "Renombrar etiqueta" });
    expect(within(dialog).getByLabelText("Nombre")).toHaveValue("Alimentación");
  });

  it("«Fusionar en otra…» abre el diálogo de fusión con el DTO capturado", async () => {
    const user = userEvent.setup();
    render(<TagCatalog tags={TAGS} />);

    await user.click(screen.getByRole("button", { name: "Acciones de Alimentación" }));
    await user.click(screen.getByRole("menuitem", { name: "Fusionar en otra…" }));

    expect(screen.getByRole("dialog", { name: "Fusionar etiqueta" })).toBeInTheDocument();
  });

  it("«Desactivar…» abre el AlertDialog de desactivación con el DTO capturado", async () => {
    const user = userEvent.setup();
    render(<TagCatalog tags={TAGS} />);

    await user.click(screen.getByRole("button", { name: "Acciones de Alimentación" }));
    await user.click(screen.getByRole("menuitem", { name: "Desactivar…" }));

    expect(screen.getByRole("alertdialog", { name: "Desactivar etiqueta" })).toBeInTheDocument();
  });

  it("la fila inactiva solo ofrece Reactivar y llama la action directamente", async () => {
    const user = userEvent.setup();
    reactivateMock.mockResolvedValueOnce({ ok: true });
    render(<TagCatalog tags={TAGS} />);

    await user.click(screen.getByRole("button", { name: "Acciones de Zapatos" }));
    const menu = screen.getByRole("menu");
    expect(within(menu).getAllByRole("menuitem")).toHaveLength(1);
    await user.click(within(menu).getByRole("menuitem", { name: "Reactivar" }));

    await waitFor(() => {
      expect(reactivateMock).toHaveBeenCalledExactlyOnceWith(3);
    });
    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Etiqueta reactivada");
    });
  });

  it("la reactivación con error tuesta el mensaje de dominio", async () => {
    const user = userEvent.setup();
    reactivateMock.mockResolvedValueOnce({
      ok: false,
      message: 'Ya existe una etiqueta con el nombre "Zapatos".',
    });
    render(<TagCatalog tags={TAGS} />);

    await user.click(screen.getByRole("button", { name: "Acciones de Zapatos" }));
    await user.click(screen.getByRole("menuitem", { name: "Reactivar" }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        'Ya existe una etiqueta con el nombre "Zapatos".',
      );
    });
  });
});
