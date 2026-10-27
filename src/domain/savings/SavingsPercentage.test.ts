import { describe, expect, it } from "vitest";

import { InvalidSavingsAllocationError } from "./SavingsAllocationErrors";
import { SavingsPercentage } from "./SavingsPercentage";

describe("SavingsPercentage", () => {
  describe("fromPercent", () => {
    it.each([
      [12.5],
      [10.25],
      [0.5],
      [Number.NaN],
    ])("rechaza el no entero %p con InvalidSavingsAllocationError(percentage)", (percent) => {
      try {
        SavingsPercentage.fromPercent(percent);
        expect.unreachable("debía lanzar InvalidSavingsAllocationError");
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidSavingsAllocationError);
        expect((error as InvalidSavingsAllocationError).field).toBe("percentage");
        expect((error as Error).message).toBe("El porcentaje debe ser un número entero entre 1 y 100.");
      }
    });

    it.each([0, -1, -10])("rechaza %d (fuera de 1..100)", (percent) => {
      expect(() => SavingsPercentage.fromPercent(percent)).toThrowError(
        InvalidSavingsAllocationError,
      );
    });

    it.each([101, 150, 1000])("rechaza %d (mayor que 100)", (percent) => {
      expect(() => SavingsPercentage.fromPercent(percent)).toThrowError(
        InvalidSavingsAllocationError,
      );
    });

    it.each([1, 10, 50, 100])("acepta el entero %d", (percent) => {
      expect(SavingsPercentage.fromPercent(percent).percent).toBe(percent);
    });
  });

  describe("appliedToCents (tabla half-up congelada, data-model §1.1)", () => {
    it.each([
      [10, 300_000, 30_000],
      [10, 300_005, 30_001],
      [33, 150, 50],
      [10, 5, 1],
      [1, 99, 1],
    ])("%d %% × %d céntimos → %d", (percent, amountCents, expected) => {
      expect(SavingsPercentage.fromPercent(percent).appliedToCents(amountCents)).toBe(expected);
    });
  });

  describe("equals", () => {
    it("dos VOs con el mismo porcentaje son iguales y distintos con otro", () => {
      const ten = SavingsPercentage.fromPercent(10);
      expect(ten.equals(SavingsPercentage.fromPercent(10))).toBe(true);
      expect(ten.equals(SavingsPercentage.fromPercent(15))).toBe(false);
    });
  });
});
