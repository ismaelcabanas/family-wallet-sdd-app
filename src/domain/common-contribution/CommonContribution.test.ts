import { describe, expect, it } from "vitest";

import { AccountId } from "../account/AccountId";
import { InvalidCommonContributionError } from "./CommonContributionErrors";
import { CommonContribution } from "./CommonContribution";
import { ContributionPercentage } from "./ContributionPercentage";

const ACCOUNT_ID = AccountId(1);

interface CommonContributionInputForTest {
  accountId: AccountId;
  percentage: ContributionPercentage;
  active: boolean;
  activatedAtMonth: string;
}

function buildInput(
  overrides: Partial<CommonContributionInputForTest> = {},
): CommonContributionInputForTest {
  return {
    accountId: ACCOUNT_ID,
    percentage: ContributionPercentage.fromBasisPoints(2500),
    active: true,
    activatedAtMonth: "2026-10",
    ...overrides,
  };
}

function percentage(basisPoints: number): ContributionPercentage {
  return ContributionPercentage.fromBasisPoints(basisPoints);
}

describe("CommonContribution", () => {
  describe("create / rehydrate", () => {
    it("nace activa con activatedAtMonth dado e id null", () => {
      const config = CommonContribution.create(buildInput());

      expect(config.id).toBeNull();
      expect(config.accountId).toBe(ACCOUNT_ID);
      expect(config.percentage.basisPoints).toBe(2500);
      expect(config.active).toBe(true);
      expect(config.activatedAtMonth).toBe("2026-10");
    });

    it("rehydrate conserva id y todos los valores", () => {
      const config = CommonContribution.rehydrate(7, buildInput({ active: false, activatedAtMonth: "2026-05" }));

      expect(config.id).toBe(7);
      expect(config.active).toBe(false);
      expect(config.activatedAtMonth).toBe("2026-05");
      expect(config.percentage.basisPoints).toBe(2500);
    });

    it("porcentaje inválido en create → InvalidCommonContributionError con campo percentage", () => {
      try {
        CommonContribution.create(buildInput({ percentage: percentage(0) }));
        expect.unreachable("debía lanzar InvalidCommonContributionError");
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidCommonContributionError);
        expect((error as InvalidCommonContributionError).field).toBe("percentage");
      }
    });

    it.each(["2026-13", "2026-1", "26-10", "octubre"])(
      "activatedAtMonth mal formado %s → error de campo activatedAtMonth",
      (activatedAtMonth) => {
        try {
          CommonContribution.create(buildInput({ activatedAtMonth }));
          expect.unreachable("debía lanzar InvalidCommonContributionError");
        } catch (error) {
          expect(error).toBeInstanceOf(InvalidCommonContributionError);
          expect((error as InvalidCommonContributionError).field).toBe("activatedAtMonth");
        }
      },
    );
  });

  describe("update", () => {
    it("actualiza el porcentaje conservando active y activatedAtMonth", () => {
      const config = CommonContribution.rehydrate(3, buildInput({ activatedAtMonth: "2026-08" }));

      const updated = config.update({ percentage: percentage(3000) });

      expect(updated.percentage.basisPoints).toBe(3000);
      expect(updated.active).toBe(true);
      expect(updated.activatedAtMonth).toBe("2026-08");
      expect(updated.id).toBe(3);
    });

    it("conserva active=false en una edición sobre config inactiva", () => {
      const config = CommonContribution.rehydrate(3, buildInput({ active: false }));

      const updated = config.update({ percentage: percentage(1250) });

      expect(updated.active).toBe(false);
    });

    it("revalida el porcentaje en update", () => {
      const config = CommonContribution.create(buildInput());

      expect(() => config.update({ percentage: percentage(10_001) })).toThrowError(
        InvalidCommonContributionError,
      );
    });
  });

  describe("deactivate / activate", () => {
    it("deactivate pone active=false conservando activatedAtMonth", () => {
      const config = CommonContribution.create(buildInput());

      const deactivated = config.deactivate();

      expect(deactivated.active).toBe(false);
      expect(deactivated.activatedAtMonth).toBe("2026-10");
      expect(deactivated.percentage.basisPoints).toBe(2500);
    });

    it("activate resetea activatedAtMonth al mes indicado", () => {
      const config = CommonContribution.create(buildInput());

      const reactivated = config.deactivate().activate("2027-01");

      expect(reactivated.active).toBe(true);
      expect(reactivated.activatedAtMonth).toBe("2027-01");
    });
  });

  describe("dueDateForMonth", () => {
    it('devuelve el día 1 fijo: "2026-10" → "2026-10-01"', () => {
      const config = CommonContribution.create(buildInput());

      expect(config.dueDateForMonth("2026-10")).toBe("2026-10-01");
      expect(config.dueDateForMonth("2027-02")).toBe("2027-02-01");
    });
  });
});
