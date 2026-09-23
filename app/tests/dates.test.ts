import { describe, expect, it } from "vitest";
import {
  financialYearLabel,
  isValidDateString,
  monthsBack,
  resolvePeriod,
  startOfFinancialYear,
  todayInShopTz,
} from "@/lib/dates";

// Wednesday, 23 Sep 2026 in IST (UTC+5:30) — well clear of any UTC/IST date-boundary edge case.
const NOW = new Date("2026-09-23T10:00:00Z");

describe("isValidDateString", () => {
  it("accepts valid calendar dates", () => {
    expect(isValidDateString("2026-09-23")).toBe(true);
  });

  it("rejects malformed or non-existent dates", () => {
    expect(isValidDateString("2026-13-01")).toBe(false);
    expect(isValidDateString("2026-02-30")).toBe(false);
    expect(isValidDateString("not-a-date")).toBe(false);
  });
});

describe("todayInShopTz", () => {
  it("resolves to the shop-local calendar date", () => {
    expect(todayInShopTz(NOW)).toBe("2026-09-23");
  });
});

describe("resolvePeriod", () => {
  it("today is a single-day range", () => {
    expect(resolvePeriod("today", undefined, NOW)).toEqual({ from: "2026-09-23", to: "2026-09-23" });
  });

  it("week starts on Monday", () => {
    expect(resolvePeriod("week", undefined, NOW)).toEqual({ from: "2026-09-21", to: "2026-09-23" });
  });

  it("month starts on the 1st", () => {
    expect(resolvePeriod("month", undefined, NOW)).toEqual({ from: "2026-09-01", to: "2026-09-23" });
  });

  it("lastMonth covers the full previous calendar month", () => {
    expect(resolvePeriod("lastMonth", undefined, NOW)).toEqual({ from: "2026-08-01", to: "2026-08-31" });
  });

  it("year starts on Jan 1", () => {
    expect(resolvePeriod("year", undefined, NOW)).toEqual({ from: "2026-01-01", to: "2026-09-23" });
  });

  it("fy starts on 1 April of the current financial year when today is after April", () => {
    expect(resolvePeriod("fy", undefined, NOW)).toEqual({ from: "2026-04-01", to: "2026-09-23" });
  });

  it("fy starts on 1 April of the previous calendar year when today is Jan-Mar", () => {
    const beforeApril = new Date("2026-02-15T10:00:00Z");
    expect(resolvePeriod("fy", undefined, beforeApril)).toEqual({ from: "2025-04-01", to: "2026-02-15" });
  });

  it("all-time has no bounds", () => {
    expect(resolvePeriod("all", undefined, NOW)).toEqual({ from: null, to: null });
  });

  it("custom passes through valid bounds", () => {
    expect(resolvePeriod("custom", { from: "2026-01-01", to: "2026-01-31" }, NOW)).toEqual({
      from: "2026-01-01",
      to: "2026-01-31",
    });
  });

  it("custom rejects missing bounds", () => {
    expect(() => resolvePeriod("custom", {}, NOW)).toThrow();
  });

  it("custom rejects from after to", () => {
    expect(() => resolvePeriod("custom", { from: "2026-02-01", to: "2026-01-01" }, NOW)).toThrow();
  });
});

describe("monthsBack", () => {
  it("returns ascending YYYY-MM labels ending at the current month", () => {
    expect(monthsBack(3, NOW)).toEqual(["2026-07", "2026-08", "2026-09"]);
  });

  it("handles year boundaries", () => {
    const now = new Date("2026-01-15T10:00:00Z");
    expect(monthsBack(3, now)).toEqual(["2025-11", "2025-12", "2026-01"]);
  });
});

describe("startOfFinancialYear", () => {
  it("returns 1 April of the same year for dates from April onward", () => {
    expect(startOfFinancialYear("2026-09-23")).toBe("2026-04-01");
    expect(startOfFinancialYear("2026-04-01")).toBe("2026-04-01");
  });

  it("returns 1 April of the previous year for dates in Jan-Mar", () => {
    expect(startOfFinancialYear("2026-03-31")).toBe("2025-04-01");
    expect(startOfFinancialYear("2026-01-01")).toBe("2025-04-01");
  });
});

describe("financialYearLabel", () => {
  it("formats as YYYY-YY", () => {
    expect(financialYearLabel(2026)).toBe("2026-27");
    expect(financialYearLabel(2099)).toBe("2099-00");
  });
});
