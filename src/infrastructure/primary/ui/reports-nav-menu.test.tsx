import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { ReportsNavMenu } from "./reports-nav-menu";

afterEach(cleanup);

describe("ReportsNavMenu", () => {
  it("muestra el trigger «Informes» que abre un menú con el único ítem «Gastos por categoría»", async () => {
    const user = userEvent.setup();
    render(<ReportsNavMenu active="panel" />);

    await user.click(screen.getByRole("button", { name: "Informes" }));

    const menu = screen.getByRole("menu", { name: "Informes" });
    const items = within(menu).getAllByRole("menuitem");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("Gastos por categoría");
  });

  it("el ítem enlaza a /reports/annual-expenses", async () => {
    const user = userEvent.setup();
    render(<ReportsNavMenu active="panel" />);

    await user.click(screen.getByRole("button", { name: "Informes" }));

    const item = within(screen.getByRole("menu", { name: "Informes" })).getByRole("menuitem", {
      name: "Gastos por categoría",
    });
    expect(item).toHaveAttribute("href", "/reports/annual-expenses");
  });

  it("marca aria-current en el ítem cuando active === 'reports'", async () => {
    const user = userEvent.setup();
    render(<ReportsNavMenu active="reports" />);

    await user.click(screen.getByRole("button", { name: "Informes" }));

    const item = within(screen.getByRole("menu", { name: "Informes" })).getByRole("menuitem", {
      name: "Gastos por categoría",
    });
    expect(item).toHaveAttribute("aria-current", "page");
  });

  it("sin active='reports' el ítem no lleva aria-current", async () => {
    const user = userEvent.setup();
    render(<ReportsNavMenu active="annual" />);

    await user.click(screen.getByRole("button", { name: "Informes" }));

    const item = within(screen.getByRole("menu", { name: "Informes" })).getByRole("menuitem", {
      name: "Gastos por categoría",
    });
    expect(item).not.toHaveAttribute("aria-current");
  });

  it("refuerza el trigger con peso tipográfico cuando la sección informes está activa", () => {
    render(<ReportsNavMenu active="reports" />);

    const trigger = screen.getByRole("button", { name: "Informes" });
    expect(trigger.className).toContain("font-medium");

    cleanup();
    render(<ReportsNavMenu active="panel" />);

    expect(screen.getByRole("button", { name: "Informes" }).className).not.toContain("font-medium");
  });
});
