import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../actions/update-movement.action", () => ({ updateMovement: vi.fn() }));
vi.mock("../actions/delete-movement.action", () => ({ deleteMovement: vi.fn() }));

import type { AccountDTO, MovementDTO, TagDTO } from "@/application/movement/dto";
import { MovementList } from "./movement-list";

const accounts: AccountDTO[] = [
  { id: 1, name: "Cuenta de Miembro A", type: "personal", memberId: 1, memberName: "Miembro A" },
  { id: 3, name: "Cuenta común", type: "shared", memberId: null, memberName: null },
];

const tags: TagDTO[] = [{ id: 1, name: "Alimentación", slug: "alimentacion" }];

const movement: MovementDTO = {
  id: 7,
  accountId: 1,
  type: "expense",
  date: "2026-08-10",
  concept: "Mercadona",
  description: null,
  amountCents: 8_500,
  nature: "personal",
  tags: [{ id: 1, name: "Alimentación", slug: "alimentacion" }],
};

function renderList(movements: MovementDTO[]) {
  return render(
    <MovementList
      movements={movements}
      accounts={accounts}
      tags={tags}
      currentAccountId={1}
      currentMonth="2026-08"
    />,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("MovementList", () => {
  it("muestra el estado vacío de 002 cuando no hay movimientos", () => {
    renderList([]);

    expect(screen.getByText(/Aún no hay movimientos en este mes/)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Movimientos del mes" })).not.toBeInTheDocument();
  });

  it("renderiza las acciones de fila de cada movimiento", () => {
    renderList([movement]);

    expect(screen.getByRole("button", { name: "Editar Mercadona" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Eliminar Mercadona" })).toBeInTheDocument();
  });

  it("el diálogo de borrado sobrevive cuando el refresco vacía la lista", async () => {
    const user = userEvent.setup();
    const { rerender } = renderList([movement]);

    await user.click(screen.getByRole("button", { name: "Eliminar Mercadona" }));
    expect(screen.getByRole("alertdialog", { name: "Eliminar movimiento" })).toBeInTheDocument();

    rerender(
      <MovementList
        movements={[]}
        accounts={accounts}
        tags={tags}
        currentAccountId={1}
        currentMonth="2026-08"
      />,
    );

    expect(screen.getByRole("alertdialog", { name: "Eliminar movimiento" })).toBeInTheDocument();
    expect(screen.getByText(/Aún no hay movimientos en este mes/)).toBeInTheDocument();
  });
});
