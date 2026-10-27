import { InvalidSavingsAllocationError } from "./SavingsAllocationErrors";

const MIN_PERCENT = 1;
const MAX_PERCENT = 100;
const HALF_DIVISOR = 100;
const HALF_UNIT = 50;

export class SavingsPercentage {
  readonly percent: number;

  private constructor(percent: number) {
    this.percent = percent;
    Object.freeze(this);
  }

  static fromPercent(percent: number): SavingsPercentage {
    if (!Number.isInteger(percent) || percent < MIN_PERCENT || percent > MAX_PERCENT) {
      throw new InvalidSavingsAllocationError(
        "percentage",
        "El porcentaje debe ser un número entero entre 1 y 100.",
      );
    }
    return new SavingsPercentage(percent);
  }

  appliedToCents(amountCents: number): number {
    return Math.floor((amountCents * this.percent + HALF_UNIT) / HALF_DIVISOR);
  }

  equals(other: SavingsPercentage): boolean {
    return this.percent === other.percent;
  }
}
