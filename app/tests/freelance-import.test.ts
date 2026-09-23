import { describe, expect, it } from "vitest";
import { interpretImportRows, parseDateFlexible, parseDelimitedTextAuto } from "@/lib/freelance-import";

describe("parseDelimitedTextAuto", () => {
  it("splits tab-delimited rows", () => {
    const rows = parseDelimitedTextAuto("a\tb\tc\nd\te\tf");
    expect(rows).toEqual([
      ["a", "b", "c"],
      ["d", "e", "f"],
    ]);
  });

  it("keeps a quoted multi-line field as a single cell", () => {
    const rows = parseDelimitedTextAuto('1\t"line one\nline two"\t5\t2026-01-01');
    expect(rows).toEqual([["1", "line one\nline two", "5", "2026-01-01"]]);
  });

  it("unescapes doubled quotes inside a quoted field", () => {
    const rows = parseDelimitedTextAuto('1\t"He said ""hi"""\t5');
    expect(rows[0][1]).toBe('He said "hi"');
  });

  it("falls back to comma delimiting when there are no tabs", () => {
    const rows = parseDelimitedTextAuto("a,b,c\nd,e,f");
    expect(rows).toEqual([
      ["a", "b", "c"],
      ["d", "e", "f"],
    ]);
  });

  it("drops blank lines", () => {
    const rows = parseDelimitedTextAuto("a\tb\n\n\nc\td");
    expect(rows).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });
});

describe("parseDateFlexible", () => {
  it("parses D/M/YYYY", () => {
    expect(parseDateFlexible("4/1/2026")).toBe("2026-01-04");
  });

  it("parses DD/MM/YYYY", () => {
    expect(parseDateFlexible("13/01/2026")).toBe("2026-01-13");
  });

  it("parses D-M-YYYY", () => {
    expect(parseDateFlexible("14-02-2026")).toBe("2026-02-14");
  });

  it("passes through an already-ISO date", () => {
    expect(parseDateFlexible("2026-09-01")).toBe("2026-09-01");
  });

  it("rejects an impossible date", () => {
    expect(parseDateFlexible("32/13/2026")).toBeNull();
  });

  it("returns null for month-only text instead of guessing", () => {
    expect(parseDateFlexible("Apr-26")).toBeNull();
  });

  it("returns null for a date range instead of picking one side", () => {
    expect(parseDateFlexible("30/05/2026 - 01/05/2026")).toBeNull();
  });
});

describe("interpretImportRows", () => {
  const sample = [
    ["EPIC1-OCR", "Completed tasks", "Hours", "Date", "Notes", ""],
    ["1", "Codebase review", "15", "4/1/2026", "All planned in epic", "Recived on upwork"],
    ["2", "OCR adapter work", "7.5", "5/1/2026", "All planned in epic", "Recived on upwork"],
    ["EPIC2-V2V", "Completed tasks", "Hours", "Date", "Notes", ""],
    ["1", "Kickoff", "2.5", "26/01/2026", "Not planned", "Recived on upwork"],
  ];

  it("groups rows under their epic header", () => {
    const result = interpretImportRows(sample);
    expect(result).toHaveLength(3);
    expect(result[0].epicName).toBe("EPIC1-OCR");
    expect(result[1].epicName).toBe("EPIC1-OCR");
    expect(result[2].epicName).toBe("EPIC2-V2V");
  });

  it("parses hours, date, description, and tagged notes", () => {
    const result = interpretImportRows(sample);
    expect(result[0]).toMatchObject({
      hours: 15,
      date: "2026-01-04",
      description: "Codebase review",
      notes: "[Recived on upwork] All planned in epic",
    });
  });

  it("ignores rows before any epic header", () => {
    const result = interpretImportRows([["1", "orphan row", "5", "2026-01-01", "", ""]]);
    expect(result).toHaveLength(0);
  });

  it("skips rows with zero, negative, or non-numeric hours", () => {
    const rows = [
      ["EPIC1-OCR", "Completed tasks", "Hours", "Date", "Notes", ""],
      ["1", "Bad hours", "0", "2026-01-01", "", ""],
      ["2", "Also bad", "not-a-number", "2026-01-01", "", ""],
      ["3", "Good", "3", "2026-01-01", "", ""],
    ];
    const result = interpretImportRows(rows);
    expect(result).toHaveLength(1);
    expect(result[0].description).toBe("Good");
  });

  it("flags unparseable dates with date: null rather than guessing", () => {
    const rows = [
      ["EPIC1-OCR", "Completed tasks", "Hours", "Date", "Notes", ""],
      ["1", "Ambiguous date", "3", "Apr-26", "", ""],
    ];
    const result = interpretImportRows(rows);
    expect(result[0].date).toBeNull();
    expect(result[0].dateRaw).toBe("Apr-26");
  });
});
