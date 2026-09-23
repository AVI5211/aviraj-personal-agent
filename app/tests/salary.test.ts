import { describe, expect, it } from "vitest";
import { computeSalaryOverview, ctcPaiseFor, netPaiseFor, totalDeductionsFor } from "@/lib/salary";

describe("salary calculations", () => {
  const record = {
    grossPaise: 100000_00,
    deductionsPaise: 2000_00,
    pfEmployeePaise: 1800_00,
    pfEmployerPaise: 1800_00,
    tdsPaise: 5000_00,
    otherCtcComponentsPaise: 0,
  };

  it("computes total deductions as other + PF employee + TDS", () => {
    expect(totalDeductionsFor(record)).toBe(2000_00 + 1800_00 + 5000_00);
  });

  it("computes in-hand as gross minus total deductions", () => {
    expect(netPaiseFor(record)).toBe(100000_00 - (2000_00 + 1800_00 + 5000_00));
  });

  it("computes CTC as gross plus employer PF", () => {
    expect(ctcPaiseFor(record)).toBe(100000_00 + 1800_00);
  });

  it("includes other CTC-only components (insurance, gym, etc.) in CTC but not in-hand", () => {
    const withExtras = { ...record, otherCtcComponentsPaise: 1500_00 };
    expect(ctcPaiseFor(withExtras)).toBe(100000_00 + 1800_00 + 1500_00);
    expect(netPaiseFor(withExtras)).toBe(netPaiseFor(record));
  });

  it("aggregates an overview across multiple records", () => {
    const overview = computeSalaryOverview([record, record]);
    expect(overview.recordCount).toBe(2);
    expect(overview.totalGrossPaise).toBe(200000_00);
    expect(overview.totalTaxPaidPaise).toBe(10000_00);
    expect(overview.totalCtcPaise).toBe(203600_00);
    expect(overview.totalOtherCtcComponentsPaise).toBe(0);
    expect(overview.totalInHandPaise).toBe(overview.totalGrossPaise - overview.totalDeductionsPaise);
  });

  it("adds other CTC components into the aggregated CTC total", () => {
    const withExtras = { ...record, otherCtcComponentsPaise: 1500_00 };
    const overview = computeSalaryOverview([withExtras, withExtras]);
    expect(overview.totalOtherCtcComponentsPaise).toBe(3000_00);
    expect(overview.totalCtcPaise).toBe(203600_00 + 3000_00);
  });

  it("returns zeroed overview for no records", () => {
    const overview = computeSalaryOverview([]);
    expect(overview.recordCount).toBe(0);
    expect(overview.totalCtcPaise).toBe(0);
    expect(overview.totalInHandPaise).toBe(0);
  });
});
