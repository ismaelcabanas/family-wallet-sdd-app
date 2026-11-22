import type { MonthSavingsDTO } from "@/application/savings/GetMonthSavings";
import { describe, expect, it } from "vitest";

import { netMonthBalanceCents, type NetMonthBalanceSavings } from "./net-month-balance";

describe("netMonthBalanceCents", () => {
  it("ahorro respaldado por movimiento → devuelve el saldo del cierre sin descuento", () => {
    expect(
      netMonthBalanceCents(100_000, { amountCents: 25_000, backedByMovement: true }),
    ).toBe(100_000);
  });

  it("fila congelada legacy (sin movimiento) → descuenta amountCents una vez", () => {
    expect(
      netMonthBalanceCents(100_000, { amountCents: 25_000, backedByMovement: false }),
    ).toBe(75_000);
  });

  it("sin fila de ahorro → descuento 0", () => {
    expect(netMonthBalanceCents(100_000, { amountCents: 0, backedByMovement: false })).toBe(
      100_000,
    );
  });

  it("admite resultado negativo", () => {
    expect(netMonthBalanceCents(-10_000, { amountCents: 25_000, backedByMovement: false })).toBe(
      -35_000,
    );
  });

  it("MonthSavingsDTO satisface estructuralmente NetMonthBalanceSavings", () => {
    const savings: MonthSavingsDTO = {
      configured: true,
      amountCents: 30_000,
      backedByMovement: false,
    };
    const structural: NetMonthBalanceSavings = savings;

    expect(netMonthBalanceCents(50_000, structural)).toBe(20_000);
  });
});
