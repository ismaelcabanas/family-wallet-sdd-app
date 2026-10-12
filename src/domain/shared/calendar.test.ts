import { describe, expect, it } from "vitest";

import { lastDayOfMonth } from "./calendar";

describe("lastDayOfMonth", () => {
  it.each([
    ["2026-02", 28],
    ["2028-02", 29],
    ["2026-04", 30],
    ["2026-06", 30],
    ["2026-09", 30],
    ["2026-11", 30],
    ["2026-01", 31],
    ["2026-03", 31],
    ["2026-05", 31],
    ["2026-07", 31],
    ["2026-08", 31],
    ["2026-10", 31],
    ["2026-12", 31],
  ])("“%s” tiene %i días", (month, expected) => {
    expect(lastDayOfMonth(month)).toBe(expected);
  });

  it("cruza el año correctamente (diciembre → enero)", () => {
    expect(lastDayOfMonth("2025-12")).toBe(31);
    expect(lastDayOfMonth("2026-01")).toBe(31);
    expect(lastDayOfMonth("2028-02")).toBe(29);
    expect(lastDayOfMonth("2100-02")).toBe(28);
  });
});
