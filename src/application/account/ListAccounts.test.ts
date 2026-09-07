import { describe, expect, it, vi } from "vitest";

import { ListAccounts } from "./ListAccounts";

describe("ListAccounts", () => {
  it("delega en el repositorio y devuelve las cuentas", async () => {
    const accounts = [
      { id: 1, name: "Cuenta de Miembro A", type: "personal" as const, memberName: "Miembro A" },
      { id: 3, name: "Cuenta común", type: "shared" as const, memberName: null },
    ];
    const repository = {
      findAll: vi.fn().mockResolvedValue(accounts),
      findById: vi.fn(),
      getBalance: vi.fn(),
    };
    const useCase = new ListAccounts(repository);

    const result = await useCase.execute();

    expect(repository.findAll).toHaveBeenCalledExactlyOnceWith();
    expect(result).toBe(accounts);
  });
});
