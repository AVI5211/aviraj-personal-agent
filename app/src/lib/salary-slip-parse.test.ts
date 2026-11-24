import { describe, expect, it } from "vitest";
import { parseSalarySlipText } from "./salary-slip-parse";

function slip({ month, earnings, deductions, net }: { month: string; earnings: string; deductions: string; net: string }) {
  return `Example Pvt Ltd Payslip for the month of ${month} Total Days : 30.00
    Earnings Amount Deductions Amount Basic Salary 50,000.00 Provident Fund 6,000.00
    Total Earnings : ${earnings} Total Deductions : ${deductions}  Net Pay :   ${net} RUPEES : ...`;
}

describe("parseSalarySlipText", () => {
  it("reads month and Indian-grouped totals", () => {
    const parsed = parseSalarySlipText(slip({ month: "June 2026", earnings: "1,20,000.00", deductions: "14,500.50", net: "1,05,499.50" }));
    expect(parsed).toEqual({
      month: "2026-06",
      grossPaise: 12000000,
      deductionsPaise: 1450050,
      netPayPaise: 10549950,
      warnings: [],
    });
  });

  it("accepts short and Sept month names", () => {
    expect(parseSalarySlipText(slip({ month: "Aug 2026", earnings: "1.00", deductions: "0.00", net: "1.00" })).month).toBe("2026-08");
    expect(parseSalarySlipText(slip({ month: "Sept 2026", earnings: "1.00", deductions: "0.00", net: "1.00" })).month).toBe("2026-09");
  });

  it("warns when Net Pay doesn't equal earnings minus deductions", () => {
    const parsed = parseSalarySlipText(slip({ month: "July 2026", earnings: "1,00,000.00", deductions: "10,000.00", net: "80,000.00" }));
    expect(parsed.warnings).toEqual(["Slip's Net Pay ₹80,000.00 doesn't match Earnings − Deductions ₹90,000.00"]);
  });

  it("reports what it couldn't find instead of guessing", () => {
    const parsed = parseSalarySlipText("Some unrelated PDF text");
    expect(parsed.month).toBeNull();
    expect(parsed.grossPaise).toBeNull();
    expect(parsed.warnings).toEqual([
      "Couldn't find the slip month",
      "Couldn't find Total Earnings",
      "Couldn't find Total Deductions",
    ]);
  });
});
