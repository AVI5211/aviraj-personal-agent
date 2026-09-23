import { describe, expect, it } from "vitest";
import { computeBalances } from "@/lib/summary";

describe("computeBalances", () => {
  it("carries forward prior activity into the opening balance", () => {
    const result = computeBalances({
      baseOpeningBalance: 10_000_00,
      priorIncome: 5_000_00,
      priorExpense: 2_000_00,
      totalIncome: 1_000_00,
      totalExpense: 400_00,
    });

    expect(result.openingBalance).toBe(13_000_00);
    expect(result.netCashFlow).toBe(600_00);
    expect(result.closingBalance).toBe(13_600_00);
  });

  it("handles an all-time range with no prior activity", () => {
    const result = computeBalances({
      baseOpeningBalance: 0,
      priorIncome: 0,
      priorExpense: 0,
      totalIncome: 500_00,
      totalExpense: 500_00,
    });

    expect(result.openingBalance).toBe(0);
    expect(result.netCashFlow).toBe(0);
    expect(result.closingBalance).toBe(0);
  });

  it("allows a negative net cash flow to reduce the closing balance", () => {
    const result = computeBalances({
      baseOpeningBalance: 1_000_00,
      priorIncome: 0,
      priorExpense: 0,
      totalIncome: 100_00,
      totalExpense: 300_00,
    });

    expect(result.netCashFlow).toBe(-200_00);
    expect(result.closingBalance).toBe(800_00);
  });
});
