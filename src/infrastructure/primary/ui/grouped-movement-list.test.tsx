import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../actions/update-movement.action", () => ({ updateMovement: vi.fn() }));
vi.mock("../actions/delete-movement.action", () => ({ deleteMovement: vi.fn() }));
vi.mock("../actions/create-movement.action", () => ({ createMovement: vi.fn() }));

import type { AccountDTO, MovementDTO, TagDTO } from "@/application/movement/dto";
import { groupMovementsByDate, GroupedMovementList } from "./grouped-movement-list";

const accounts: AccountDTO[] = [
  { id: 1, name: "Cuenta de Miembro A", type: "personal", memberId: 1, memberName: "Miembro A" },
  { id: 2, name: "Cuenta de Miembro B", type: "personal", memberId: 2, memberName: "Miembro B" },
  { id: 3, name: "Cuenta común", type: "shared", memberId: null, memberName: null },
];

const tags: TagDTO[] = [{ id: 1, name: "Alimentación", slug: "alimentacion" }];

function buildMovement(overrides: Partial<MovementDTO> = {}): MovementDTO {
  return {
    id: 1,
    accountId: 2,
    type: "expense",
    date: "2026-04-05",
    concept: "Mercadona",
    description: null,
    amountCents: 8_500,
    nature: "personal",
    tags: [{ id: 1, name: "Alimentación", slug: "alimentacion" }],
    ...overrides,
  };
}

function renderList(movements: MovementDTO[]) {
  return render(
    <GroupedMovementList
      movements={movements}
      accounts={accounts}
      tags={tags}
      currentAccountId={2}
      currentMonth="2026-04"
      accountName="Cuenta de Miembro B"
      accountType="personal"
    />,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("groupMovementsByDate", () => {
  it("agrupa por fecha en orden de aparición sin reordenar la entrada", () => {
    const older = buildMovement({ id: 1, date: "2026-04-02", concept: "Cine" });
    const newerFirst = buildMovement({ id: 3, date: "2026-04-05", concept: "Gasolina" });
    const newerSecond = buildMovement({ id: 2, date: "2026-04-05", concept: "Mercadona" });

    const groups = groupMovementsByDate([newerFirst, newerSecond, older]);

    expect(groups.map((group) => group.date)).toEqual(["2026-04-05", "2026-04-02"]);
    expect(groups[0].movements.map((movement) => movement.id)).toEqual([3, 2]);
    expect(groups[1].movements.map((movement) => movement.id)).toEqual([1]);
  });

  it("aplanar los grupos recupera exactamente la entrada (invariante)", () => {
    const input = [
      buildMovement({ id: 3, date: "2026-04-05" }),
      buildMovement({ id: 2, date: "2026-04-05", concept: "Gasolina" }),
      buildMovement({ id: 1, date: "2026-04-02", concept: "Cine" }),
    ];

    const flattened = groupMovementsByDate(input).flatMap((group) => group.movements);

    expect(flattened).toEqual(input);
  });
});

describe("GroupedMovementList", () => {
  it("muestra el grupo más reciente arriba y el orden interno por registro", () => {
    renderList([
      buildMovement({ id: 3, date: "2026-04-05", concept: "Gasolina" }),
      buildMovement({ id: 2, date: "2026-04-05", concept: "Mercadona" }),
      buildMovement({ id: 1, date: "2026-04-02", concept: "Cine" }),
    ]);

    const groups = screen.getAllByRole("heading", { level: 3 });
    expect(groups.map((group) => group.textContent)).toEqual([
      "5 de abril de 2026",
      "2 de abril de 2026",
    ]);

    const items = screen.getAllByTestId("movement-item");
    expect(items.map((item) => item.querySelector("div.min-w-0 > span")?.textContent)).toEqual([
      "Gasolina",
      "Mercadona",
      "Cine",
    ]);
  });

  it("muestra la nota concatenada concepto · descripción y solo concepto sin descripción", () => {
    renderList([
      buildMovement({ id: 1, concept: "Mercadona", description: "compra semanal" }),
      buildMovement({ id: 2, concept: "Cine", description: null }),
    ]);

    expect(screen.getByText("Mercadona · compra semanal")).toBeInTheDocument();
    expect(screen.getByText("Cine")).toBeInTheDocument();
  });

  it("muestra el distintivo de naturaleza solo en gastos", () => {
    renderList([
      buildMovement({ id: 1, type: "expense", nature: "shared", concept: "Mercadona" }),
      buildMovement({ id: 2, type: "income", nature: null, concept: "Nómina", amountCents: 1_000_000 }),
    ]);

    expect(screen.getByText("Común")).toBeInTheDocument();
    expect(screen.queryByText("Personal")).not.toBeInTheDocument();
  });

  it("muestra el distintivo Personal en gastos personales", () => {
    renderList([buildMovement({ id: 1, type: "expense", nature: "personal" })]);

    expect(screen.getByText("Personal")).toBeInTheDocument();
  });

  it("pinta importes con signo y color semántico por tipo, sin texto Gasto/Ingreso", () => {
    renderList([
      buildMovement({ id: 1, type: "expense", amountCents: 8_500 }),
      buildMovement({ id: 2, type: "income", nature: null, amountCents: 50_000 }),
    ]);

    const expense = screen.getByText(/−85,00/);
    expect(expense.className).toContain("text-red-600");
    const income = screen.getByText(/\+500,00/);
    expect(income.className).toContain("text-emerald-600");

    expect(screen.queryByText("Gasto")).not.toBeInTheDocument();
    expect(screen.queryByText("Ingreso")).not.toBeInTheDocument();
  });

  it("pinta la tag Sin Clasificar como cualquier otra", () => {
    renderList([
      buildMovement({ tags: [{ id: 9, name: "Sin Clasificar", slug: "sin-clasificar" }] }),
    ]);

    expect(screen.getByText("Sin Clasificar")).toBeInTheDocument();
  });

  it("abre los diálogos de 003 al pulsar editar o eliminar desde la fila", async () => {
    const user = userEvent.setup();
    renderList([buildMovement({ id: 7 })]);

    await user.click(screen.getByRole("button", { name: "Editar Mercadona" }));
    expect(screen.getByRole("dialog", { name: "Editar movimiento" })).toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "Eliminar Mercadona" }));
    expect(screen.getByRole("alertdialog", { name: "Eliminar movimiento" })).toBeInTheDocument();
  });

  it("el estado vacío se renderiza dentro del propio listado montado", () => {
    renderList([]);

    expect(screen.getByText(/Aún no hay movimientos en este mes/)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Movimientos del mes" })).not.toBeInTheDocument();
  });

  it("el diálogo de borrado sobrevive cuando el refresco vacía la lista", async () => {
    const user = userEvent.setup();
    const { rerender } = renderList([buildMovement({ id: 7 })]);

    await user.click(screen.getByRole("button", { name: "Eliminar Mercadona" }));
    expect(screen.getByRole("alertdialog", { name: "Eliminar movimiento" })).toBeInTheDocument();

    rerender(
      <GroupedMovementList
        movements={[]}
        accounts={accounts}
        tags={tags}
        currentAccountId={2}
        currentMonth="2026-04"
        accountName="Cuenta de Miembro B"
        accountType="personal"
      />,
    );

    expect(screen.getByRole("alertdialog", { name: "Eliminar movimiento" })).toBeInTheDocument();
    expect(screen.getByText(/Aún no hay movimientos en este mes/)).toBeInTheDocument();
  });

  it("muestra el CTA «Nuevo movimiento» con movimientos y también en estado vacío", () => {
    renderList([buildMovement({ id: 7 })]);
    expect(screen.getByRole("button", { name: "Nuevo movimiento" })).toBeInTheDocument();

    cleanup();
    renderList([]);
    expect(screen.getByRole("button", { name: "Nuevo movimiento" })).toBeInTheDocument();
  });

  it("el estado vacío ya no menciona el formulario superior y guía al CTA", () => {
    renderList([]);

    expect(screen.queryByText(/formulario superior/)).not.toBeInTheDocument();
    expect(screen.getByText(/Pulsa «Nuevo movimiento» para registrar el primero/)).toBeInTheDocument();
  });

  it("pulsar el CTA abre el diálogo de alta y cerrarlo lo desmonta", async () => {
    const user = userEvent.setup();
    renderList([buildMovement({ id: 7 })]);

    await user.click(screen.getByRole("button", { name: "Nuevo movimiento" }));
    expect(screen.getByRole("dialog", { name: "Nuevo movimiento" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("el CTA abre el diálogo de alta también desde el estado vacío", async () => {
    const user = userEvent.setup();
    renderList([]);

    await user.click(screen.getByRole("button", { name: "Nuevo movimiento" }));
    expect(screen.getByRole("dialog", { name: "Nuevo movimiento" })).toBeInTheDocument();
  });
});
