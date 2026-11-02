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

import type { CatalogTagDTO, TagCatalogGroupDTO } from "@/application/tag/dto";
import { TagCatalog } from "./tag-catalog";

const TAG_ALIMENTACION: CatalogTagDTO = {
  id: 1,
  name: "Alimentación",
  slug: "alimentacion",
  status: "active",
  isProtected: false,
};
const TAG_APORTACION: CatalogTagDTO = {
  id: 100,
  name: "Aportación Común",
  slug: "aportacion-comun",
  status: "active",
  isProtected: true,
};
const TAG_ZAPATOS: CatalogTagDTO = {
  id: 3,
  name: "Zapatos",
  slug: "zapatos",
  status: "inactive",
  isProtected: false,
};

const GROUPS: TagCatalogGroupDTO[] = [
  {
    category: { id: 1, name: "General", isDefault: true },
    tags: [TAG_APORTACION, TAG_ALIMENTACION, TAG_ZAPATOS],
  },
  {
    category: { id: 2, name: "Viajes", isDefault: false },
    tags: [],
  },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TagCatalog (agrupado por categorías)", () => {
  it("renderiza la región del catálogo con un grupo por categoría y su cardinal", () => {
    render(<TagCatalog groups={GROUPS} />);

    const region = screen.getByRole("region", { name: "Catálogo de etiquetas" });
    const general = within(region).getByRole("region", { name: "Categoría General" });
    const viajes = within(region).getByRole("region", { name: "Categoría Viajes" });

    expect(within(general).getAllByRole("listitem")).toHaveLength(3);
    expect(general).toHaveTextContent("3 etiquetas");
    expect(within(viajes).queryAllByRole("listitem")).toHaveLength(0);
    expect(viajes).toHaveTextContent("Sin etiquetas");
  });

  it("renderiza los grupos en el orden del DTO (la UI no ordena)", () => {
    const reversed = [...GROUPS].reverse();
    render(<TagCatalog groups={reversed} />);

    const region = screen.getByRole("region", { name: "Catálogo de etiquetas" });
    const groups = region.querySelectorAll("section[aria-label^='Categoría ']");
    expect(groups[0]).toHaveAttribute("aria-label", "Categoría Viajes");
    expect(groups[1]).toHaveAttribute("aria-label", "Categoría General");
  });

  it("muestra el botón «Nueva categoría» en la cabecera del catálogo", () => {
    render(<TagCatalog groups={GROUPS} />);

    expect(
      screen.getByRole("button", { name: "Nueva categoría" }),
    ).toBeInTheDocument();
  });

  it("el estado vacío global se muestra dentro de la genérica", () => {
    render(
      <TagCatalog
        groups={[{ category: { id: 1, name: "General", isDefault: true }, tags: [] }]}
      />,
    );

    const general = screen.getByRole("region", { name: "Categoría General" });
    expect(within(general).getByText("No hay etiquetas todavía.")).toBeInTheDocument();
  });

  it("la fila activa no protegida ofrece Mover a categoría… primero, luego Renombrar/Fusionar/Desactivar", async () => {
    const user = userEvent.setup();
    render(<TagCatalog groups={GROUPS} />);

    await user.click(screen.getByRole("button", { name: "Acciones de Alimentación" }));

    const menu = screen.getByRole("menu");
    const items = within(menu).getAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "Mover a categoría…",
      "Renombrar…",
      "Fusionar en otra…",
      "Desactivar…",
    ]);
  });

  it("la fila inactiva ofrece Mover a categoría… y Reactivar", async () => {
    const user = userEvent.setup();
    render(<TagCatalog groups={GROUPS} />);

    await user.click(screen.getByRole("button", { name: "Acciones de Zapatos" }));

    const menu = screen.getByRole("menu");
    expect(within(menu).getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Mover a categoría…",
      "Reactivar",
    ]);
  });

  it("la fila protegida «Aportación Común» tiene menú cuyo único ítem es «Mover a categoría…»", async () => {
    const user = userEvent.setup();
    render(<TagCatalog groups={GROUPS} />);

    await user.click(screen.getByRole("button", { name: "Acciones de Aportación Común" }));

    const menu = screen.getByRole("menu");
    expect(within(menu).getAllByRole("menuitem")).toHaveLength(1);
    expect(within(menu).getByRole("menuitem", { name: "Mover a categoría…" })).toBeInTheDocument();
  });

  it("«Mover a categoría…» abre el diálogo de movimiento con el DTO capturado", async () => {
    const user = userEvent.setup();
    render(<TagCatalog groups={GROUPS} />);

    await user.click(screen.getByRole("button", { name: "Acciones de Alimentación" }));
    await user.click(screen.getByRole("menuitem", { name: "Mover a categoría…" }));

    expect(screen.getByRole("dialog", { name: "Mover etiqueta" })).toBeInTheDocument();
  });

  it("el menú de la genérica solo ofrece «Renombrar…» (sin «Eliminar…»)", async () => {
    const user = userEvent.setup();
    render(<TagCatalog groups={GROUPS} />);

    await user.click(screen.getByRole("button", { name: "Acciones de la categoría General" }));

    const menu = screen.getByRole("menu");
    expect(within(menu).getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Renombrar…",
    ]);
  });

  it("el menú de una categoría no genérica ofrece «Renombrar…» y «Eliminar…»", async () => {
    const user = userEvent.setup();
    render(<TagCatalog groups={GROUPS} />);

    await user.click(screen.getByRole("button", { name: "Acciones de la categoría Viajes" }));

    const menu = screen.getByRole("menu");
    expect(within(menu).getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Renombrar…",
      "Eliminar…",
    ]);
  });

  it("«Nueva categoría» abre el diálogo de creación", async () => {
    const user = userEvent.setup();
    render(<TagCatalog groups={GROUPS} />);

    await user.click(screen.getByRole("button", { name: "Nueva categoría" }));

    expect(screen.getByRole("dialog", { name: "Nueva categoría" })).toBeInTheDocument();
  });

  it("«Renombrar…» del menú de categoría abre el diálogo con el nombre actual", async () => {
    const user = userEvent.setup();
    render(<TagCatalog groups={GROUPS} />);

    await user.click(screen.getByRole("button", { name: "Acciones de la categoría Viajes" }));
    await user.click(screen.getByRole("menuitem", { name: "Renombrar…" }));

    const dialog = screen.getByRole("dialog", { name: "Renombrar categoría" });
    expect(within(dialog).getByLabelText("Nombre")).toHaveValue("Viajes");
  });

  it("«Eliminar…» del menú de categoría abre el AlertDialog de confirmación", async () => {
    const user = userEvent.setup();
    render(<TagCatalog groups={GROUPS} />);

    await user.click(screen.getByRole("button", { name: "Acciones de la categoría Viajes" }));
    await user.click(screen.getByRole("menuitem", { name: "Eliminar…" }));

    expect(screen.getByRole("alertdialog", { name: "Eliminar categoría" })).toBeInTheDocument();
  });

  it("«Renombrar…» de etiqueta abre el diálogo 004 con el DTO capturado", async () => {
    const user = userEvent.setup();
    render(<TagCatalog groups={GROUPS} />);

    await user.click(screen.getByRole("button", { name: "Acciones de Alimentación" }));
    await user.click(screen.getByRole("menuitem", { name: "Renombrar…" }));

    const dialog = screen.getByRole("dialog", { name: "Renombrar etiqueta" });
    expect(within(dialog).getByLabelText("Nombre")).toHaveValue("Alimentación");
  });

  it("«Fusionar en otra…» y «Desactivar…» siguen abriendo sus diálogos 004", async () => {
    const user = userEvent.setup();
    render(<TagCatalog groups={GROUPS} />);

    await user.click(screen.getByRole("button", { name: "Acciones de Alimentación" }));
    await user.click(screen.getByRole("menuitem", { name: "Fusionar en otra…" }));
    expect(screen.getByRole("dialog", { name: "Fusionar etiqueta" })).toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "Acciones de Alimentación" }));
    await user.click(screen.getByRole("menuitem", { name: "Desactivar…" }));
    expect(screen.getByRole("alertdialog", { name: "Desactivar etiqueta" })).toBeInTheDocument();
  });

  it("la fila inactiva reactiva vía action directa con toast", async () => {
    const user = userEvent.setup();
    reactivateMock.mockResolvedValueOnce({ ok: true });
    render(<TagCatalog groups={GROUPS} />);

    await user.click(screen.getByRole("button", { name: "Acciones de Zapatos" }));
    await user.click(screen.getByRole("menuitem", { name: "Reactivar" }));

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
    render(<TagCatalog groups={GROUPS} />);

    await user.click(screen.getByRole("button", { name: "Acciones de Zapatos" }));
    await user.click(screen.getByRole("menuitem", { name: "Reactivar" }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        'Ya existe una etiqueta con el nombre "Zapatos".',
      );
    });
  });
});
