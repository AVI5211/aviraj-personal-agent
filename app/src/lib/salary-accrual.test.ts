import { describe, expect, it } from "vitest";
import { earnedSalaryPaise } from "./salary";

describe("earnedSalaryPaise", () => {
  const october = { month: "2026-10" };
  const ctc = 11_679_500;

  it("prorates expected pay for October 1 and 2", () => {
    expect(earnedSalaryPaise(october, ctc, "2026-10-01", "2026-10-01", "2026-10-02")).toBe(376_758);
    expect(earnedSalaryPaise(october, ctc, "2026-10-02", "2026-10-02", "2026-10-02")).toBe(376_758);
    expect(earnedSalaryPaise(october, ctc, "2026-10-01", "2026-10-31", "2026-10-02")).toBe(753_516);
  });

  it("never counts future salary, but completes a past month", () => {
    expect(earnedSalaryPaise(october, ctc, null, null, "2026-09-30")).toBe(0);
    expect(earnedSalaryPaise(october, ctc, "2026-10-03", "2026-10-03", "2026-10-02")).toBe(0);
    expect(earnedSalaryPaise(october, ctc, null, null, "2026-11-01")).toBe(ctc);
  });
});
