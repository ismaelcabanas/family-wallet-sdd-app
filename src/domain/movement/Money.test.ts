import { describe, expect, it } from "vitest";

import { InvalidMoneyError } from "./MovementErrors";
import { Money } from "./Money";

describe("Money", () => {
  it("crea un importe desde céntimos positivos", () => {
    const money = Money.fromCents(85_000);
    expect(money.amountCents).toBe(85_000);
  });

  it("acepta el máximo permitido (999.999.999,99 €)", () => {
    expect(Money.fromCents(99_999_999_999).amountCents).toBe(99_999_999_999);
  });

  it("rechaza cero", () => {
    expect(() => Money.fromCents(0)).toThrowError(InvalidMoneyError);
  });

  it("rechaza importes negativos", () => {
    expect(() => Money.fromCents(-1)).toThrowError(InvalidMoneyError);
  });

  it("rechaza céntimos no enteros (sin floats)", () => {
    expect(() => Money.fromCents(850.5)).toThrowError(InvalidMoneyError);
    expect(() => Money.fromCents(Number.NaN)).toThrowError(InvalidMoneyError);
  });

  it("rechaza superar el máximo (999.999.999,99 €)", () => {
    expect(() => Money.fromCents(100_000_000_000)).toThrowError(InvalidMoneyError);
  });

  it("fromCentsOrZero permite 0 y negativos (balances)", () => {
    expect(Money.fromCentsOrZero(0).amountCents).toBe(0);
    expect(Money.fromCentsOrZero(-1_250).amountCents).toBe(-1_250);
  });

  it("fromCentsOrZero rechaza no enteros", () => {
    expect(() => Money.fromCentsOrZero(0.5)).toThrowError(InvalidMoneyError);
  });

  it("add es aritmética entera exacta (10,29 + 0,01 = 10,30)", () => {
    const result = Money.fromCents(1_029).add(Money.fromCents(1));
    expect(result.amountCents).toBe(1_030);
  });

  it("subtract es aritmética entera exacta", () => {
    const result = Money.fromCentsOrZero(1_500_00).subtract(Money.fromCents(85_000));
    expect(result.amountCents).toBe(65_000);
  });

  it("es inmutable: add/subtract devuelven una nueva instancia", () => {
    const original = Money.fromCents(100);
    original.add(Money.fromCents(50));
    original.subtract(Money.fromCents(50));
    expect(original.amountCents).toBe(100);
  });

  it("equals compara por céntimos", () => {
    expect(Money.fromCents(500).equals(Money.fromCents(500))).toBe(true);
    expect(Money.fromCents(500).equals(Money.fromCents(501))).toBe(false);
  });
});
