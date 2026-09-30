import { describe, expect, it } from "vitest";
import { overviewIncomeAverage } from "./overview-income-average";

describe("overviewIncomeAverage", () => {
  const gross = 3_200_000_00;

  it("defaults the month card to January-through-September earnings over nine completed months", () => {
    expect(overviewIncomeAverage("month", "2026-10-01", gross)?.value).toBe(Math.round(gross / 9));
  });

  it("uses elapsed calendar days and weeks for today and this week", () => {
    expect(overviewIncomeAverage("today", "2026-01-08", 8_000)?.value).toBe(1_000);
    expect(overviewIncomeAverage("week", "2026-01-08", 8_000)?.value).toBe(7_000);
  });

  it("uses earnings through yesterday for this year's daily average", () => {
    expect(overviewIncomeAverage("year", "2026-10-01", gross, 0, 2_730_000)?.value).toBe(10_000);
  });

  it("uses completed financial-year months, including across calendar years", () => {
    expect(overviewIncomeAverage("fy", "2026-10-01", gross, 600_000)?.value).toBe(100_000);
    expect(overviewIncomeAverage("fy", "2027-01-01", gross, 900_000)?.value).toBe(100_000);
  });

  it("hides the income average for yesterday, all time, and custom", () => {
    for (const period of ["yesterday", "all", "custom"] as const) {
      expect(overviewIncomeAverage(period, "2026-10-01", gross)).toBeNull();
    }
  });
});
