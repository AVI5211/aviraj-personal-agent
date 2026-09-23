import { describe, expect, it } from "vitest";
import { computeLoanSummary, addMonthsToDateString } from "@/lib/loans";

describe("computeLoanSummary", () => {
  it("returns zeroed summary when there are no payments", () => {
    const result = computeLoanSummary({ monthlyEmiPaise: 10_000_00 }, []);
    expect(result).toEqual({
      paidCount: 0,
      pendingCount: 0,
      totalPaidPaise: 0,
      scheduledRemainingPaise: 0,
    });
  });

  it("counts paid and pending installments separately", () => {
    const result = computeLoanSummary(
      { monthlyEmiPaise: 10_000_00 },
      [
        { status: "paid", amountPaise: 10_000_00 },
        { status: "paid", amountPaise: 9_500_00 },
        { status: "scheduled", amountPaise: 10_000_00 },
        { status: "scheduled", amountPaise: 10_000_00 },
      ]
    );

    expect(result.paidCount).toBe(2);
    expect(result.pendingCount).toBe(2);
    expect(result.totalPaidPaise).toBe(19_500_00);
    // scheduledRemainingPaise is a projection: pendingCount * monthlyEmiPaise, not outstanding principal
    expect(result.scheduledRemainingPaise).toBe(20_000_00);
  });

  it("does not conflate scheduled remaining with outstanding principal", () => {
    // Even if actual paid amounts differ from EMI (e.g. partial payments), the projection
    // for pending installments always uses monthlyEmiPaise, not any principal figure.
    const result = computeLoanSummary(
      { monthlyEmiPaise: 5_000_00 },
      [
        { status: "paid", amountPaise: 4_000_00 },
        { status: "scheduled", amountPaise: 5_000_00 },
      ]
    );

    expect(result.totalPaidPaise).toBe(4_000_00);
    expect(result.scheduledRemainingPaise).toBe(5_000_00);
  });
});

describe("addMonthsToDateString", () => {
  it("adds months within the same year", () => {
    expect(addMonthsToDateString("2026-01-15", 1)).toBe("2026-02-15");
  });

  it("rolls over to the next year", () => {
    expect(addMonthsToDateString("2026-12-05", 1)).toBe("2027-01-05");
  });

  it("handles multi-month jumps", () => {
    expect(addMonthsToDateString("2026-01-31", 1)).toBe("2026-03-03");
  });
});
