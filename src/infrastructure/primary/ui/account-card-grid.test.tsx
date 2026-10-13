import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { actionMock } = vi.hoisted(() => ({
  actionMock: vi.fn(),
}));

vi.mock("../actions/configure-regular-income.action", () => ({
  configureRegularIncome: actionMock,
}));

import type { AccountDTO } from "@/application/movement/dto";
import type { RegularIncomeDTO } from "@/application/regular-income/dto";

import { AccountCardGrid, regularIncomeMenuStatus } from "./account-card-grid";

const ACCOUNTS: AccountDTO[] = [
  { id: 1, name: "Cuenta de Miembro A", type: "personal", memberId: 1, memberName: "Miembro A" },
  { id: 2, name: "Cuenta de Miembro B", type: "personal", memberId: 2, memberName: "Miembro B" },
  { id: 3, name: "Cuenta común", type: "shared", memberId: null, memberName: null },
];

const activeConfig: RegularIncomeDTO = {
  accountId: 1,
  amountCents: 200_000,
  dayOfMonth: 1,
  note: "Ingreso regular de Miembro A",
  active: true,
  activatedAtMonth: "2026-08",
};

const inactiveConfig: RegularIncomeDTO = { ...activeConfig, active: false };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AccountCardGrid", () => {
  it("renderiza una tarjeta por cuenta en el orden de entrada como lista etiquetada", () => {
    render(<AccountCardGrid accounts={ACCOUNTS} regularIncomes={{}} />);

    const list = screen.getByRole("list", { name: "Cuentas" });
    expect(list).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);

    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Cuenta de Miembro ACuenta personal de Miembro A",
      "Cuenta de Miembro BCuenta personal de Miembro B",
      "Cuenta comúnCuenta común",
    ]);
    expect(list).toContainElement(links[0]);
  });

  it("usa el nombre y el tipo exactos como nombre accesible del enlace", () => {
    render(<AccountCardGrid accounts={ACCOUNTS} regularIncomes={{}} />);

    expect(
      screen.getByRole("link", { name: /Cuenta de Miembro A\s*Cuenta personal de Miembro A/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Cuenta de Miembro B\s*Cuenta personal de Miembro B/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Cuenta común\s*Cuenta común/ })).toBeInTheDocument();
  });

  it("enlaza a /accounts/{id} sin query string", () => {
    render(<AccountCardGrid accounts={ACCOUNTS} regularIncomes={{}} />);

    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/accounts/1",
      "/accounts/2",
      "/accounts/3",
    ]);
  });

  it("no muestra ningún importe (sin €) ni datos derivados", () => {
    render(<AccountCardGrid accounts={ACCOUNTS} regularIncomes={{ 1: activeConfig, 2: inactiveConfig }} />);

    expect(screen.queryByText(/€/)).not.toBeInTheDocument();
    expect(screen.queryByText(/_balance_|balance|gasto/i)).not.toBeInTheDocument();
  });

  it("las tarjetas de cuentas con y sin datos financieros son equivalentes", () => {
    const withMovements: AccountDTO = { ...ACCOUNTS[1] };
    const withoutMovements: AccountDTO = { ...ACCOUNTS[2] };

    render(
      <AccountCardGrid
        accounts={[withMovements, withoutMovements]}
        regularIncomes={{ 2: activeConfig }}
      />,
    );

    const links = screen.getAllByRole("link");
    expect(links[0].querySelectorAll("*")).toHaveLength(links[1].querySelectorAll("*").length);
    expect(links[0].children).toHaveLength(links[1].children.length);
  });

  it("con memberName null usa el fallback 'miembro' en la etiqueta personal", () => {
    render(
      <AccountCardGrid
        accounts={[{ id: 4, name: "Cuenta sin miembro", type: "personal", memberId: null, memberName: null }]}
        regularIncomes={{}}
      />,
    );

    expect(
      screen.getByRole("link", { name: /Cuenta sin miembro\s*Cuenta personal de miembro/ }),
    ).toBeInTheDocument();
  });

  it("el menú ⋮ solo aparece en cuentas personales, con nombre accesible único por tarjeta", () => {
    render(<AccountCardGrid accounts={ACCOUNTS} regularIncomes={{}} />);

    expect(
      screen.getByRole("button", { name: "Configuración de Cuenta de Miembro A" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Configuración de Cuenta de Miembro B" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Configuración de Cuenta común" })).not.toBeInTheDocument();
  });

  it("el botón del menú no está dentro del enlace (patrón stretched-link)", () => {
    render(<AccountCardGrid accounts={ACCOUNTS} regularIncomes={{}} />);

    for (const link of screen.getAllByRole("link")) {
      expect(link.querySelector("button")).toBeNull();
    }
    expect(
      screen.getByRole("button", { name: "Configuración de Cuenta de Miembro A" }).closest("a"),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Configuración de Cuenta de Miembro B" }).closest("a"),
    ).toBeNull();
  });

  it("el ítem «Ingreso regular» muestra el estado derivado de la config", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <AccountCardGrid accounts={ACCOUNTS} regularIncomes={{ 1: null, 2: activeConfig }} />,
    );

    await user.click(screen.getByRole("button", { name: "Configuración de Cuenta de Miembro A" }));
    const menuA = screen.getByRole("menu");
    expect(
      within(menuA).getByRole("menuitem", { name: /Ingreso regular\s*Sin configurar/ }),
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Configuración de Cuenta de Miembro B" }));
    const menuB = screen.getByRole("menu");
    expect(
      within(menuB).getByRole("menuitem", { name: /Ingreso regular\s*Activa/ }),
    ).toBeInTheDocument();
    unmount();

    render(<AccountCardGrid accounts={ACCOUNTS} regularIncomes={{ 1: inactiveConfig }} />);
    await user.click(screen.getByRole("button", { name: "Configuración de Cuenta de Miembro A" }));
    expect(
      within(screen.getByRole("menu")).getByRole("menuitem", { name: /Ingreso regular\s*Desactivada/ }),
    ).toBeInTheDocument();
  });

  it("seleccionar el ítem cierra el menú y abre el diálogo «Ingreso regular»", async () => {
    const user = userEvent.setup();
    render(<AccountCardGrid accounts={ACCOUNTS} regularIncomes={{ 1: null, 2: activeConfig }} />);

    await user.click(screen.getByRole("button", { name: "Configuración de Cuenta de Miembro B" }));
    await user.click(
      within(screen.getByRole("menu")).getByRole("menuitem", { name: /Ingreso regular\s*Activa/ }),
    );

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    const dialog = screen.getByRole("dialog", { name: "Ingreso regular" });
    expect(within(dialog).getByLabelText("Importe (€)")).toHaveValue("2000,00");
    expect(within(dialog).getByRole("button", { name: "Desactivar" })).toBeInTheDocument();
  });

  it("regularIncomeMenuStatus deriva los literales congelados", () => {
    expect(regularIncomeMenuStatus(null)).toBe("Sin configurar");
    expect(regularIncomeMenuStatus(activeConfig)).toBe("Activa");
    expect(regularIncomeMenuStatus(inactiveConfig)).toBe("Desactivada");
  });
});
