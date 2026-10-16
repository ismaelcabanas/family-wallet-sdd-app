import { InvalidCommonContributionError } from "./CommonContributionErrors";

const MIN_BASIS_POINTS = 1;
const MAX_BASIS_POINTS = 10_000;
const HALF_DIVISOR = 10_000;
const HALF_UNIT = 5_000;

export class ContributionPercentage {
  readonly basisPoints: number;

  private constructor(basisPoints: number) {
    this.basisPoints = basisPoints;
    Object.freeze(this);
  }

  static fromBasisPoints(basisPoints: number): ContributionPercentage {
    if (!Number.isInteger(basisPoints) || basisPoints < MIN_BASIS_POINTS || basisPoints > MAX_BASIS_POINTS) {
      throw new InvalidCommonContributionError(
        "percentage",
        "El porcentaje debe estar entre 0 y 100.",
      );
    }
    return new ContributionPercentage(basisPoints);
  }

  appliedToCents(amountCents: number): number {
    return Math.floor((amountCents * this.basisPoints + HALF_UNIT) / HALF_DIVISOR);
  }

  equals(other: ContributionPercentage): boolean {
    return this.basisPoints === other.basisPoints;
  }
}
