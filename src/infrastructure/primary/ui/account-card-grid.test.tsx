import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { AccountDTO } from "@/application/movement/dto";

import { AccountCardGrid } from "./account-card-grid";

afterEach(() => {
  cleanup();
});

const ACCOUNTS: AccountDTO[] = [
  { id: 1, name: "Cuenta de Miembro A", type: "personal", memberId: 1, memberName: "Miembro A" },
  { id: 2, name: "Cuenta de Miembro B", type: "personal", memberId: 2, memberName: "Miembro B" },
  { id: 3, name: "Cuenta común", type: "shared", memberId: null, memberName: null },
];

describe("AccountCardGrid", () => {
  it("renderiza una tarjeta por cuenta en el orden de entrada como lista etiquetada", () => {
    render(<AccountCardGrid accounts={ACCOUNTS} />);

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
    render(<AccountCardGrid accounts={ACCOUNTS} />);

    expect(
      screen.getByRole("link", { name: /Cuenta de Miembro A\s*Cuenta personal de Miembro A/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Cuenta de Miembro B\s*Cuenta personal de Miembro B/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Cuenta común\s*Cuenta común/ })).toBeInTheDocument();
  });

  it("enlaza a /accounts/{id} sin query string", () => {
    render(<AccountCardGrid accounts={ACCOUNTS} />);

    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/accounts/1",
      "/accounts/2",
      "/accounts/3",
    ]);
  });

  it("no muestra ningún importe (sin €) ni datos derivados", () => {
    render(<AccountCardGrid accounts={ACCOUNTS} />);

    expect(screen.queryByText(/€/)).not.toBeInTheDocument();
    expect(screen.queryByText(/_balance_|balance|gasto/i)).not.toBeInTheDocument();
  });

  it("las tarjetas de cuentas con y sin datos financieros son equivalentes", () => {
    const withMovements: AccountDTO = { ...ACCOUNTS[1] };
    const withoutMovements: AccountDTO = { ...ACCOUNTS[2] };

    render(<AccountCardGrid accounts={[withMovements, withoutMovements]} />);

    const links = screen.getAllByRole("link");
    expect(links[0].querySelectorAll("*")).toHaveLength(links[1].querySelectorAll("*").length);
    expect(links[0].children).toHaveLength(links[1].children.length);
  });

  it("con memberName null usa el fallback 'miembro' en la etiqueta personal", () => {
    render(
      <AccountCardGrid
        accounts={[{ id: 4, name: "Cuenta sin miembro", type: "personal", memberId: null, memberName: null }]}
      />,
    );

    expect(
      screen.getByRole("link", { name: /Cuenta sin miembro\s*Cuenta personal de miembro/ }),
    ).toBeInTheDocument();
  });
});
