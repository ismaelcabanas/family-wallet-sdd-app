import { describe, expect, it } from "vitest";

import {
  buildMonthWindow,
  currentMonth,
  formatAmountCents,
  formatSignedAmountCents,
  monthLabel,
  todayIsoDate,
} from "./format";

describe("formatAmountCents", () => {
  it("formatea céntimos como EUR en formato español", () => {
    const formatted = formatAmountCents(85_000);
    expect(formatted).toMatch(/850,00[\s\u00A0\u202F]€/);
  });

  it("formatea importes negativos (cuenta en números rojos)", () => {
    const formatted = formatAmountCents(-1_250);
    expect(formatted).toMatch(/-12,50[\s\u00A0\u202F]€/);
  });

  it("formatea cero", () => {
    expect(formatAmountCents(0)).toMatch(/0,00[\s\u00A0\u202F]€/);
  });
});

describe("formatSignedAmountCents", () => {
  it("marca los gastos con signo menos contable", () => {
    const formatted = formatSignedAmountCents(85_000, "expense");
    expect(formatted).toMatch(/^\u2212850,00[\s\u00A0\u202F]€$/);
  });

  it("marca los ingresos con signo más", () => {
    const formatted = formatSignedAmountCents(1_000_000_00, "income");
    expect(formatted).toMatch(/^\+1\.000\.000,00[\s\u00A0\u202F]€$/);
  });
});

describe("fechas y meses", () => {
  it("todayIsoDate devuelve la fecha local en ISO", () => {
    expect(todayIsoDate(new Date(2026, 8, 3))).toBe("2026-09-03");
  });

  it("currentMonth devuelve el mes actual YYYY-MM", () => {
    expect(currentMonth(new Date(2026, 0, 15))).toBe("2026-01");
    expect(currentMonth(new Date(2026, 11, 15))).toBe("2026-12");
  });

  it("monthLabel muestra el nombre del mes en español capitalizado", () => {
    expect(monthLabel("2026-09")).toBe("Septiembre de 2026");
    expect(monthLabel("2026-01")).toBe("Enero de 2026");
  });

  it("buildMonthWindow genera una ventana navegable alrededor del mes central", () => {
    const window = buildMonthWindow("2026-09", 2);
    expect(window).toEqual(["2026-07", "2026-08", "2026-09", "2026-10", "2026-11"]);
  });

  it("buildMonthWindow cruza el límite de año correctamente", () => {
    const window = buildMonthWindow("2027-01", 1);
    expect(window).toEqual(["2026-12", "2027-01", "2027-02"]);
  });
});
