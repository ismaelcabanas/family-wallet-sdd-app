import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { actionMock } = vi.hoisted(() => ({
  actionMock: vi.fn(),
}));

vi.mock("../actions/configure-regular-income.action", () => ({
  configureRegularIncome: actionMock,
}));

vi.mock("../actions/configure-common-contribution.action", () => ({
  configureCommonContribution: vi.fn(),
}));

vi.mock("../actions/configure-savings-allocation.action", () => ({
  configureSavingsAllocation: vi.fn(),
}));

import type { AccountDTO } from "@/application/movement/dto";
import type { RegularIncomeDTO } from "@/application/regular-income/dto";
import type { CommonContributionDTO } from "@/application/common-contribution/dto";
import type { SavingsAllocationDTO } from "@/application/savings/dto";

import {
  AccountCardGrid,
  commonContributionMenuStatus,
  regularIncomeMenuStatus,
  savingsMenuStatus,
} from "./account-card-grid";

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
    render(<AccountCardGrid accounts={ACCOUNTS} regularIncomes={{}}
        commonContributions={{}} savingsAllocations={{}} />);

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
    render(<AccountCardGrid accounts={ACCOUNTS} regularIncomes={{}}
        commonContributions={{}} savingsAllocations={{}} />);

    expect(
      screen.getByRole("link", { name: /Cuenta de Miembro A\s*Cuenta personal de Miembro A/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Cuenta de Miembro B\s*Cuenta personal de Miembro B/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Cuenta común\s*Cuenta común/ })).toBeInTheDocument();
  });

  it("enlaza a /accounts/{id} sin query string", () => {
    render(<AccountCardGrid accounts={ACCOUNTS} regularIncomes={{}}
        commonContributions={{}} savingsAllocations={{}} />);

    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/accounts/1",
      "/accounts/2",
      "/accounts/3",
    ]);
  });

  it("no muestra ningún importe (sin €) ni datos derivados", () => {
    render(<AccountCardGrid accounts={ACCOUNTS} regularIncomes={{ 1: activeConfig, 2: inactiveConfig }}
        commonContributions={{}} savingsAllocations={{}} />);

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
        commonContributions={{}} savingsAllocations={{}}
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
        commonContributions={{}} savingsAllocations={{}}
      />,
    );

    expect(
      screen.getByRole("link", { name: /Cuenta sin miembro\s*Cuenta personal de miembro/ }),
    ).toBeInTheDocument();
  });

  it("el menú ⋮ solo aparece en cuentas personales, con nombre accesible único por tarjeta", () => {
    render(<AccountCardGrid accounts={ACCOUNTS} regularIncomes={{}}
        commonContributions={{}} savingsAllocations={{}} />);

    expect(
      screen.getByRole("button", { name: "Configuración de Cuenta de Miembro A" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Configuración de Cuenta de Miembro B" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Configuración de Cuenta común" })).not.toBeInTheDocument();
  });

  it("el botón del menú no está dentro del enlace (patrón stretched-link)", () => {
    render(<AccountCardGrid accounts={ACCOUNTS} regularIncomes={{}}
        commonContributions={{}} savingsAllocations={{}} />);

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
      <AccountCardGrid accounts={ACCOUNTS} regularIncomes={{ 1: null, 2: activeConfig }}
      commonContributions={{}} savingsAllocations={{}} />,
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

    render(<AccountCardGrid accounts={ACCOUNTS} regularIncomes={{ 1: inactiveConfig }}
      commonContributions={{}} savingsAllocations={{}} />);
    await user.click(screen.getByRole("button", { name: "Configuración de Cuenta de Miembro A" }));
    expect(
      within(screen.getByRole("menu")).getByRole("menuitem", { name: /Ingreso regular\s*Desactivada/ }),
    ).toBeInTheDocument();
  });

  it("seleccionar el ítem cierra el menú y abre el diálogo «Ingreso regular»", async () => {
    const user = userEvent.setup();
    render(<AccountCardGrid accounts={ACCOUNTS} regularIncomes={{ 1: null, 2: activeConfig }}
      commonContributions={{}} savingsAllocations={{}} />);

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

  const contributionActive: CommonContributionDTO = {
    accountId: 1,
    percentageBasisPoints: 2500,
    active: true,
    activatedAtMonth: "2026-08",
  };

  const contributionInactive: CommonContributionDTO = { ...contributionActive, active: false };

  describe("commonContributionMenuStatus", () => {
    it("sin ingreso regular → «Requiere ingreso regular»", () => {
      expect(commonContributionMenuStatus(contributionActive, null)).toBe(
        "Requiere ingreso regular",
      );
      expect(commonContributionMenuStatus(null, null)).toBe("Requiere ingreso regular");
    });

    it("con ingreso y sin aportación → «Sin configurar»", () => {
      expect(commonContributionMenuStatus(null, activeConfig)).toBe("Sin configurar");
    });

    it("aportación activa → «Activa»", () => {
      expect(commonContributionMenuStatus(contributionActive, activeConfig)).toBe("Activa");
    });

    it("aportación inactiva → «Desactivada»", () => {
      expect(commonContributionMenuStatus(contributionInactive, activeConfig)).toBe(
        "Desactivada",
      );
    });
  });

  it("el ítem «Aportación» aparece segundo bajo «Ingreso regular» solo en cuentas personales con estado a la derecha", async () => {
    const user = userEvent.setup();
    render(
      <AccountCardGrid
        accounts={ACCOUNTS}
        regularIncomes={{ 1: null, 2: activeConfig }}
        commonContributions={{ 1: null, 2: contributionActive }} savingsAllocations={{}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Configuración de Cuenta de Miembro A" }));
    const menuA = screen.getByRole("menu");
    const itemsA = within(menuA).getAllByRole("menuitem");
    expect(itemsA.map((item) => item.textContent)).toEqual([
      "Ingreso regularSin configurar",
      "AportaciónRequiere ingreso regular",
      "AhorroRequiere ingreso regular",
    ]);

    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Configuración de Cuenta de Miembro B" }));
    const menuB = screen.getByRole("menu");
    expect(
      within(menuB).getByRole("menuitem", { name: /Aportación\s*Activa/ }),
    ).toBeInTheDocument();
    expect(
      within(menuB).getByRole("menuitem", { name: /Aportación\s*Activa/ }).querySelector(
        ".ml-auto",
      ),
    ).not.toBeNull();
  });

  it("sin ingreso regular: el ítem «Aportación» queda deshabilitado y no abre diálogo", async () => {
    const user = userEvent.setup();
    render(
      <AccountCardGrid
        accounts={ACCOUNTS}
        regularIncomes={{ 1: null, 2: null }}
        commonContributions={{ 1: null, 2: null }} savingsAllocations={{}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Configuración de Cuenta de Miembro A" }));
    const item = within(screen.getByRole("menu")).getByRole("menuitem", {
      name: /Aportación\s*Requiere ingreso regular/,
    });
    expect(item).toHaveAttribute("aria-disabled", "true");
    expect(item).toHaveAttribute("data-disabled");

    await user.click(item);
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("con ingreso regular: «Aportación» abre el diálogo dentro de la tarjeta", async () => {
    const user = userEvent.setup();
    render(
      <AccountCardGrid
        accounts={ACCOUNTS}
        regularIncomes={{ 1: null, 2: activeConfig }}
        commonContributions={{ 1: null, 2: null }} savingsAllocations={{}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Configuración de Cuenta de Miembro B" }));
    await user.click(
      within(screen.getByRole("menu")).getByRole("menuitem", { name: /Aportación\s*Sin configurar/ }),
    );

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    const dialog = screen.getByRole("dialog", { name: "Aportación a la cuenta común" });
    expect(within(dialog).getByLabelText("Porcentaje (%)")).toHaveValue("");
  });

  it("la cuenta común sigue sin menú de configuración", () => {
    render(<AccountCardGrid accounts={ACCOUNTS} regularIncomes={{}} commonContributions={{}} savingsAllocations={{}} />);

    expect(
      screen.queryByRole("button", { name: "Configuración de Cuenta común" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /Aportación/ })).not.toBeInTheDocument();
  });

  const savingsActive: SavingsAllocationDTO = {
    accountId: 1,
    percentage: 10,
    active: true,
    activatedAtMonth: "2026-08",
  };

  const savingsInactive: SavingsAllocationDTO = { ...savingsActive, active: false };

  describe("savingsMenuStatus", () => {
    it("sin ingreso regular → «Requiere ingreso regular»", () => {
      expect(savingsMenuStatus(savingsActive, null)).toBe("Requiere ingreso regular");
      expect(savingsMenuStatus(null, null)).toBe("Requiere ingreso regular");
    });

    it("con ingreso y sin ahorro → «Sin configurar»", () => {
      expect(savingsMenuStatus(null, activeConfig)).toBe("Sin configurar");
    });

    it("ahorro activo → «Activo»", () => {
      expect(savingsMenuStatus(savingsActive, activeConfig)).toBe("Activo");
    });

    it("ahorro inactivo → «Desactivado»", () => {
      expect(savingsMenuStatus(savingsInactive, activeConfig)).toBe("Desactivado");
    });
  });

  it("el ítem «Ahorro» aparece tercero bajo «Ingreso regular» y «Aportación» con estado a la derecha", async () => {
    const user = userEvent.setup();
    render(
      <AccountCardGrid
        accounts={ACCOUNTS}
        regularIncomes={{ 1: activeConfig, 2: activeConfig }}
        commonContributions={{ 1: null, 2: null }} savingsAllocations={{ 1: null, 2: savingsActive }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Configuración de Cuenta de Miembro B" }));
    const menu = screen.getByRole("menu");
    const items = within(menu).getAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "Ingreso regularActiva",
      "AportaciónSin configurar",
      "AhorroActivo",
    ]);
    expect(items[2].querySelector(".ml-auto")).not.toBeNull();
  });

  it("sin ingreso regular: el ítem «Ahorro» queda deshabilitado y no abre diálogo", async () => {
    const user = userEvent.setup();
    render(
      <AccountCardGrid
        accounts={ACCOUNTS}
        regularIncomes={{ 1: null, 2: null }}
        commonContributions={{ 1: null, 2: null }} savingsAllocations={{ 1: null, 2: null }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Configuración de Cuenta de Miembro A" }));
    const item = within(screen.getByRole("menu")).getByRole("menuitem", {
      name: /Ahorro\s*Requiere ingreso regular/,
    });
    expect(item).toHaveAttribute("aria-disabled", "true");
    expect(item).toHaveAttribute("data-disabled");

    await user.click(item);
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("con ingreso regular: «Ahorro» abre el diálogo dentro de la tarjeta", async () => {
    const user = userEvent.setup();
    render(
      <AccountCardGrid
        accounts={ACCOUNTS}
        regularIncomes={{ 1: null, 2: activeConfig }}
        commonContributions={{ 1: null, 2: null }} savingsAllocations={{ 1: null, 2: null }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Configuración de Cuenta de Miembro B" }));
    await user.click(
      within(screen.getByRole("menu")).getByRole("menuitem", { name: /Ahorro\s*Sin configurar/ }),
    );

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    const dialog = screen.getByRole("dialog", { name: "Ahorro mensual" });
    expect(within(dialog).getByLabelText("Porcentaje (%)")).toHaveValue("");
  });

  it("con ahorro configurado: el diálogo abre pre-rellenado (instancia fresca por apertura)", async () => {
    const user = userEvent.setup();
    render(
      <AccountCardGrid
        accounts={ACCOUNTS}
        regularIncomes={{ 1: null, 2: activeConfig }}
        commonContributions={{ 1: null, 2: null }} savingsAllocations={{ 1: null, 2: savingsActive }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Configuración de Cuenta de Miembro B" }));
    await user.click(
      within(screen.getByRole("menu")).getByRole("menuitem", { name: /Ahorro\s*Activo/ }),
    );

    const dialog = screen.getByRole("dialog", { name: "Ahorro mensual" });
    expect(within(dialog).getByLabelText("Porcentaje (%)")).toHaveValue("10");
    expect(within(dialog).getByRole("button", { name: "Desactivar" })).toBeInTheDocument();
  });

  it("la cuenta común sigue sin ítem «Ahorro»", () => {
    render(<AccountCardGrid accounts={ACCOUNTS} regularIncomes={{}} commonContributions={{}} savingsAllocations={{}} />);

    expect(screen.queryByRole("menuitem", { name: /Ahorro/ })).not.toBeInTheDocument();
  });
});
