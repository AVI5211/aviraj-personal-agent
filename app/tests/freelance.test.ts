import { describe, expect, it } from "vitest";
import { computeGrossAmountMinor, computeInHandPaise, computeNetInrPaise } from "@/lib/freelance";

describe("computeGrossAmountMinor", () => {
  it("sums billable hours across work logs and multiplies by the hourly rate", () => {
    const workLogs = [{ billableHours: 5 }, { billableHours: 3.5 }];
    expect(computeGrossAmountMinor(workLogs, 5000)).toBe(42_500);
  });

  it("returns 0 for no work logs", () => {
    expect(computeGrossAmountMinor([], 5000)).toBe(0);
  });

  it("rounds fractional cent results", () => {
    const workLogs = [{ billableHours: 1 / 3 }];
    expect(computeGrossAmountMinor(workLogs, 100)).toBe(Math.round((1 / 3) * 100));
  });
});

describe("computeNetInrPaise", () => {
  it("converts USD gross minus fees to INR paise using the exchange rate", () => {
    // $100 gross (10000 cents), $5 fee (500 cents), rate 83.25 INR/USD
    const netInrPaise = computeNetInrPaise(10_000, 500, 83.25);
    // (10000 - 500) cents * 83.25 = 790875 paise = INR 7,908.75
    expect(netInrPaise).toBe(790_875);
  });

  it("treats INR clients with exchangeRate=1 as a direct paise passthrough", () => {
    const netInrPaise = computeNetInrPaise(50_000_00, 1_000_00, 1);
    expect(netInrPaise).toBe(49_000_00);
  });

  it("handles zero fees", () => {
    const netInrPaise = computeNetInrPaise(20_00, 0, 83);
    expect(netInrPaise).toBe(20_00 * 83);
  });
});

describe("computeInHandPaise", () => {
  it("subtracts tax paid from the net settlement", () => {
    expect(computeInHandPaise(41_583_38, 5_000_00)).toBe(36_583_38);
  });

  it("returns the full net amount when no tax was paid", () => {
    expect(computeInHandPaise(10_000_00, 0)).toBe(10_000_00);
  });
});
