import { describe, expect, it } from "vitest";
import { computeInvestmentSummary } from "@/lib/investments";

describe("computeInvestmentSummary", () => {
  it("returns zeroes and null gain/loss for an empty portfolio", () => {
    const result = computeInvestmentSummary([]);

    expect(result.totalCurrentValuePaise).toBe(0);
    expect(result.totalInvestedValuePaise).toBe(0);
    expect(result.gainLossPaise).toBeNull();
    expect(result.byType.equity).toBe(0);
  });

  it("sums current and invested values and computes gain/loss when known", () => {
    const result = computeInvestmentSummary([
      { holdingType: "equity", currentValuePaise: 150_000_00, investedValuePaise: 100_000_00 },
      { holdingType: "mutual_fund", currentValuePaise: 50_000_00, investedValuePaise: 60_000_00 },
    ]);

    expect(result.totalCurrentValuePaise).toBe(200_000_00);
    expect(result.totalInvestedValuePaise).toBe(160_000_00);
    expect(result.gainLossPaise).toBe(40_000_00);
    expect(result.byType.equity).toBe(150_000_00);
    expect(result.byType.mutual_fund).toBe(50_000_00);
  });

  it("only sums the known invested values but still marks gainLoss as known", () => {
    const result = computeInvestmentSummary([
      { holdingType: "fixed_deposit", currentValuePaise: 100_000_00, investedValuePaise: 90_000_00 },
      { holdingType: "savings", currentValuePaise: 20_000_00, investedValuePaise: null },
    ]);

    expect(result.totalCurrentValuePaise).toBe(120_000_00);
    expect(result.totalInvestedValuePaise).toBe(90_000_00);
    expect(result.gainLossPaise).toBe(30_000_00);
  });

  it("returns null gain/loss when no holdings have a known invested value", () => {
    const result = computeInvestmentSummary([
      { holdingType: "other", currentValuePaise: 10_000_00, investedValuePaise: null },
      { holdingType: "savings", currentValuePaise: 5_000_00, investedValuePaise: null },
    ]);

    expect(result.totalInvestedValuePaise).toBe(0);
    expect(result.gainLossPaise).toBeNull();
  });
});
