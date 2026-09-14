import { describe, expect, it } from "vitest";

import {
  buildMonthWindow,
  currentMonth,
  formatAmountCents,
  formatCentsForInput,
  formatDate,
  formatSignedAmountCents,
  formatSignedCents,
  monthLabel,
  monthYearLabel,
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

describe("formatSignedCents", () => {
  it("marca el saldo positivo con signo más", () => {
    expect(formatSignedCents(94_950)).toMatch(/^\+949,50[\s\u00A0\u202F]€$/);
  });

  it("marca el saldo negativo con signo menos contable", () => {
    expect(formatSignedCents(-5_120)).toMatch(/^\u221251,20[\s\u00A0\u202F]€$/);
  });

  it("muestra el cero exactamente compensado sin signo", () => {
    expect(formatSignedCents(0)).toMatch(/^0,00[\s\u00A0\u202F]€$/);
    expect(formatSignedCents(0)).not.toMatch(/^[+\u2212]/);
  });
});

describe("formatCentsForInput", () => {
  it("convierte céntimos a texto de entrada con coma decimal y dos decimales", () => {
    expect(formatCentsForInput(7_850)).toBe("78,50");
    expect(formatCentsForInput(85_000)).toBe("850,00");
  });

  it("no usa separador de miles aunque el importe lo requiera", () => {
    expect(formatCentsForInput(15_000_000)).toBe("150000,00");
  });

  it("rellena un decimal incompleto a dos dígitos", () => {
    expect(formatCentsForInput(1_205)).toBe("12,05");
  });
});

describe("formatDate", () => {
  it("muestra la fecha larga en español", () => {
    expect(formatDate("2026-09-14")).toBe("14 de septiembre de 2026");
  });

  it("cruza meses y años distintos correctamente", () => {
    expect(formatDate("2026-01-01")).toBe("1 de enero de 2026");
    expect(formatDate("2024-12-31")).toBe("31 de diciembre de 2024");
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

  it("monthYearLabel muestra el mes y el año sin preposición (avisos de movimiento movido)", () => {
    expect(monthYearLabel("2026-08")).toBe("Agosto 2026");
    expect(monthYearLabel("2026-12")).toBe("Diciembre 2026");
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
