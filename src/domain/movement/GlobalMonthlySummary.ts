import { Money } from "./Money";
import { MonthlyClosure, type ClosureMovementInput, type TagBreakdownEntry } from "./MonthlyClosure";

export interface GlobalSummaryMovementInput extends ClosureMovementInput {
  accountId: number;
}

export interface SummaryAccountRef {
  id: number;
  type: "personal" | "shared";
  memberId: number | null;
  memberName: string | null;
}

export interface MemberBreakdownEntry {
  memberId: number | null;
  memberName: string | null;
  personal: Money;
  shared: Money;
}

interface MemberAccumulator {
  memberId: number | null;
  memberName: string | null;
  personalCents: number;
  sharedCents: number;
}

function memberKey(memberId: number | null): string {
  return memberId === null ? "common" : `member-${memberId}`;
}

function compareMemberEntries(a: MemberAccumulator, b: MemberAccumulator): number {
  const totalDiff = b.personalCents + b.sharedCents - (a.personalCents + a.sharedCents);
  if (totalDiff !== 0) return totalDiff;
  if (a.memberId === null && b.memberId !== null) return 1;
  if (b.memberId === null && a.memberId !== null) return -1;
  const nameDiff = (a.memberName ?? "").localeCompare(b.memberName ?? "", "es");
  if (nameDiff !== 0) return nameDiff;
  return memberKey(a.memberId).localeCompare(memberKey(b.memberId), "es");
}

export class GlobalMonthlySummary {
  readonly incomeTotal: Money;
  readonly expenseTotal: Money;
  readonly sharedExpenseTotal: Money;
  readonly personalExpenseTotal: Money;
  readonly monthBalance: Money;
  readonly tagBreakdown: readonly TagBreakdownEntry[];
  readonly memberBreakdown: readonly MemberBreakdownEntry[];

  private constructor(closure: MonthlyClosure, memberBreakdown: MemberBreakdownEntry[]) {
    this.incomeTotal = closure.incomeTotal;
    this.expenseTotal = closure.expenseTotal;
    this.sharedExpenseTotal = closure.sharedExpenseTotal;
    this.personalExpenseTotal = closure.personalExpenseTotal;
    this.monthBalance = closure.monthBalance;
    this.tagBreakdown = closure.tagBreakdown;
    this.memberBreakdown = Object.freeze([...memberBreakdown]);
    Object.freeze(this);
  }

  static fromMovements(
    inputs: readonly GlobalSummaryMovementInput[],
    accounts: readonly SummaryAccountRef[],
  ): GlobalMonthlySummary {
    const closure = MonthlyClosure.fromMovements(inputs);
    const memberBreakdown = GlobalMonthlySummary.buildMemberBreakdown(inputs, accounts);

    return new GlobalMonthlySummary(closure, memberBreakdown);
  }

  private static buildMemberBreakdown(
    inputs: readonly GlobalSummaryMovementInput[],
    accounts: readonly SummaryAccountRef[],
  ): MemberBreakdownEntry[] {
    const accountsById = new Map<number, SummaryAccountRef>();
    for (const account of accounts) {
      accountsById.set(account.id, account);
    }

    const breakdownByMemberKey = new Map<string, MemberAccumulator>();

    for (const input of inputs) {
      if (input.type === "income") continue;

      const account = accountsById.get(input.accountId);
      const isPersonal = account?.type === "personal" && account.memberId !== null;
      const memberId = isPersonal ? (account?.memberId as number) : null;
      const memberName = isPersonal ? (account?.memberName ?? null) : null;
      const key = memberKey(memberId);

      const entry =
        breakdownByMemberKey.get(key) ??
        { memberId, memberName, personalCents: 0, sharedCents: 0 };
      if (input.nature === "personal") {
        entry.personalCents += input.amountCents;
      } else if (input.nature === "shared") {
        entry.sharedCents += input.amountCents;
      }
      breakdownByMemberKey.set(key, entry);
    }

    return [...breakdownByMemberKey.values()]
      .sort(compareMemberEntries)
      .map((entry) =>
        Object.freeze({
          memberId: entry.memberId,
          memberName: entry.memberName,
          personal: Money.fromCentsOrZero(entry.personalCents),
          shared: Money.fromCentsOrZero(entry.sharedCents),
        }),
      );
  }
}
