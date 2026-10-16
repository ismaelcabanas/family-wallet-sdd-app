import { describe, expect, it } from "vitest";

import { InvalidCommonContributionError } from "./CommonContributionErrors";
import { ContributionPercentage } from "./ContributionPercentage";

describe("ContributionPercentage", () => {
  describe("fromBasisPoints (validaciones)", () => {
    it.each([2500.5, 100.25, Number.NaN])("rechaza el valor no entero %s", (basisPoints) => {
      expect(() => ContributionPercentage.fromBasisPoints(basisPoints)).toThrowError(
        InvalidCommonContributionError,
      );
    });

    it.each([0, -1, -2500])("rechaza el valor %s fuera del rango 1..10 000", (basisPoints) => {
      expect(() => ContributionPercentage.fromBasisPoints(basisPoints)).toThrowError(
        InvalidCommonContributionError,
      );
    });

    it.each([10_001, 100_000])("rechaza el valor %s por encima de 10 000", (basisPoints) => {
      expect(() => ContributionPercentage.fromBasisPoints(basisPoints)).toThrowError(
        InvalidCommonContributionError,
      );
    });

    it("el error de porcentaje lleva el campo «percentage»", () => {
      try {
        ContributionPercentage.fromBasisPoints(0);
        expect.unreachable("debía lanzar InvalidCommonContributionError");
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidCommonContributionError);
        expect((error as InvalidCommonContributionError).field).toBe("percentage");
      }
    });

    it.each([1, 100, 2500, 3333, 10_000])("acepta el valor %s", (basisPoints) => {
      expect(ContributionPercentage.fromBasisPoints(basisPoints).basisPoints).toBe(basisPoints);
    });
  });

  describe("appliedToCents (half-up entero, tabla congelada data-model §1.1)", () => {
    it.each([
      { basisPoints: 2500, amountCents: 200_000, expected: 50_000 },
      { basisPoints: 3333, amountCents: 200_000, expected: 66_660 },
      { basisPoints: 2500, amountCents: 150_050, expected: 37_513 },
      { basisPoints: 1250, amountCents: 200_000, expected: 25_000 },
    ])(
      "$basisPoints bp × $amountCents céntimos → $expected",
      ({ basisPoints, amountCents, expected }) => {
        const percentage = ContributionPercentage.fromBasisPoints(basisPoints);

        expect(percentage.appliedToCents(amountCents)).toBe(expected);
      },
    );

    it("0,01 % sobre 500 céntimos redondea a 0 (edge §7 documentado)", () => {
      const percentage = ContributionPercentage.fromBasisPoints(1);

      expect(percentage.appliedToCents(500)).toBe(0);
    });
  });

  describe("equals", () => {
    it("dos VOs con los mismos puntos base son iguales", () => {
      expect(ContributionPercentage.fromBasisPoints(2500)).toEqual(
        ContributionPercentage.fromBasisPoints(2500),
      );
      expect(
        ContributionPercentage.fromBasisPoints(2500).equals(
          ContributionPercentage.fromBasisPoints(2500),
        ),
      ).toBe(true);
    });

    it("dos VOs con distintos puntos base no son iguales", () => {
      expect(
        ContributionPercentage.fromBasisPoints(2500).equals(
          ContributionPercentage.fromBasisPoints(3000),
        ),
      ).toBe(false);
    });
  });
});
