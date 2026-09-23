import { describe, expect, it } from "vitest";
import { rupeesToPaise, paiseToRupees, formatPaiseAsInr, sumPaise } from "@/lib/money";

describe("money", () => {
  it("converts rupees to integer paise", () => {
    expect(rupeesToPaise(650)).toBe(65000);
    expect(rupeesToPaise(10.5)).toBe(1050);
  });

  it("rejects negative rupee amounts", () => {
    expect(() => rupeesToPaise(-5)).toThrow();
  });

  it("converts paise back to rupees", () => {
    expect(paiseToRupees(65000)).toBe(650);
  });

  it("formats paise as INR currency", () => {
    expect(formatPaiseAsInr(650000)).toContain("6,500");
  });

  it("sums a list of paise amounts", () => {
    expect(sumPaise([100, 200, 300])).toBe(600);
    expect(sumPaise([])).toBe(0);
  });
});
