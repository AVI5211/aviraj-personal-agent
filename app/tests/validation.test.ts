import { describe, expect, it } from "vitest";
import { createAccountSchema, createSalaryRecordSchema, createTransactionSchema } from "@/lib/validation";

const base = {
  module: "shop" as const,
  amountPaise: 5000,
  paymentMethod: "cash" as const,
  transactionDate: "2026-09-23",
  description: "",
};

describe("createTransactionSchema", () => {
  it("accepts a valid shop expense with an allowed category", () => {
    const result = createTransactionSchema.safeParse({ ...base, type: "expense", category: "rent" });
    expect(result.success).toBe(true);
  });

  it("rejects a shop expense with a category outside the allowed list", () => {
    const result = createTransactionSchema.safeParse({ ...base, type: "expense", category: "made_up_category" });
    expect(result.success).toBe(false);
  });

  it("accepts a personal expense with an allowed personal category", () => {
    const result = createTransactionSchema.safeParse({
      ...base,
      module: "personal",
      type: "expense",
      category: "groceries",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a personal expense with a shop-only category", () => {
    const result = createTransactionSchema.safeParse({
      ...base,
      module: "personal",
      type: "expense",
      category: "stock",
    });
    expect(result.success).toBe(false);
  });

  it("allows any non-empty category for income", () => {
    const result = createTransactionSchema.safeParse({ ...base, type: "income", category: "shop_sales" });
    expect(result.success).toBe(true);
  });

  it("rejects a zero or negative amount", () => {
    const result = createTransactionSchema.safeParse({ ...base, type: "income", category: "shop_sales", amountPaise: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer amount", () => {
    const result = createTransactionSchema.safeParse({
      ...base,
      type: "income",
      category: "shop_sales",
      amountPaise: 100.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid transaction date", () => {
    const result = createTransactionSchema.safeParse({
      ...base,
      type: "income",
      category: "shop_sales",
      transactionDate: "2026-02-30",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown module", () => {
    const result = createTransactionSchema.safeParse({ ...base, module: "business", type: "income", category: "x" });
    expect(result.success).toBe(false);
  });
});

describe("createAccountSchema", () => {
  it("accepts a valid account", () => {
    const result = createAccountSchema.safeParse({ name: "HDFC Savings", type: "bank", balancePaise: 100000 });
    expect(result.success).toBe(true);
  });

  it("rejects a negative balance", () => {
    const result = createAccountSchema.safeParse({ name: "HDFC Savings", type: "bank", balancePaise: -100 });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown account type", () => {
    const result = createAccountSchema.safeParse({ name: "X", type: "crypto", balancePaise: 100 });
    expect(result.success).toBe(false);
  });
});

describe("createSalaryRecordSchema", () => {
  it("accepts a valid salary record and defaults status/deductions", () => {
    const result = createSalaryRecordSchema.safeParse({ month: "2026-09", grossPaise: 100000 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("expected");
      expect(result.data.deductionsPaise).toBe(0);
    }
  });

  it("rejects a malformed month", () => {
    const result = createSalaryRecordSchema.safeParse({ month: "September 2026", grossPaise: 100000 });
    expect(result.success).toBe(false);
  });

  it("rejects a non-positive gross amount", () => {
    const result = createSalaryRecordSchema.safeParse({ month: "2026-09", grossPaise: 0 });
    expect(result.success).toBe(false);
  });
});
