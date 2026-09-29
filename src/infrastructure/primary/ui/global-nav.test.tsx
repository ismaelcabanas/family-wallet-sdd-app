import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { currentMonth } from "./format";
import { GlobalNav } from "./global-nav";

afterEach(() => {
  cleanup();
});

function getLink(name: string) {
  return screen.getByRole("link", { name });
}

describe("GlobalNav", () => {
  it("muestra el landmark de navegación con los 3 enlaces en orden", () => {
    render(<GlobalNav active="panel" month="2026-03" />);

    const nav = screen.getByRole("navigation", { name: "Navegación principal" });
    const links = screen.getAllByRole("link");
    expect(nav).toContainElement(links[0]);
    expect(links).toHaveLength(3);
    expect(links[0]).toHaveTextContent("Panel");
    expect(links[1]).toHaveTextContent("Resumen global");
    expect(links[2]).toHaveTextContent("Cuenta de resultados");
  });

  it.each(["panel", "summary", "annual"] as const)(
    "marca aria-current solo en el enlace activo cuando active=%s",
    (active) => {
      render(<GlobalNav active={active} month="2026-03" />);

      const activeLink = getLink(
        active === "panel"
          ? "Panel"
          : active === "summary"
            ? "Resumen global"
            : "Cuenta de resultados",
      );
      expect(activeLink).toHaveAttribute("aria-current", "page");

      const inactive = screen
        .getAllByRole("link")
        .filter((link) => link !== activeLink);
      expect(inactive).toHaveLength(2);
      for (const link of inactive) {
        expect(link).not.toHaveAttribute("aria-current");
      }
    },
  );

  it("con month prop usa ese mes en los destinos y Panel enlaza a / sin query", () => {
    render(<GlobalNav active="panel" month="2026-03" />);

    expect(getLink("Panel")).toHaveAttribute("href", "/");
    expect(getLink("Resumen global")).toHaveAttribute("href", "/summary?month=2026-03");
    expect(getLink("Cuenta de resultados")).toHaveAttribute("href", "/annual?year=2026");
  });

  it("sin month prop cae a currentMonth() para los destinos", () => {
    render(<GlobalNav active="summary" />);

    const month = currentMonth();
    expect(getLink("Panel")).toHaveAttribute("href", "/");
    expect(getLink("Resumen global")).toHaveAttribute(
      "href",
      `/summary?month=${month}`,
    );
    expect(getLink("Cuenta de resultados")).toHaveAttribute(
      "href",
      `/annual?year=${month.slice(0, 4)}`,
    );
  });

  it("la página de cuenta (active=panel) marca Panel como activo", () => {
    render(<GlobalNav active="panel" month="2026-03" />);

    expect(getLink("Panel")).toHaveAttribute("aria-current", "page");
    expect(getLink("Resumen global")).not.toHaveAttribute("aria-current");
  });

  it("refuerza el enlace activo con peso tipográfico", () => {
    render(<GlobalNav active="summary" month="2026-03" />);

    expect(getLink("Resumen global").className).toContain("font-medium");
    expect(getLink("Panel").className).not.toContain("font-medium");
  });
});
