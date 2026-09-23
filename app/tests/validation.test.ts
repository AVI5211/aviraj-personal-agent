import { describe, expect, it } from "vitest";
import { createTransactionSchema } from "@/lib/validation";

const base = {
  amountPaise: 5000,
  paymentMethod: "cash" as const,
  transactionDate: "2026-09-23",
  description: "",
};

describe("createTransactionSchema", () => {
  it("accepts a valid expense with an allowed category", () => {
    const result = createTransactionSchema.safeParse({ ...base, type: "expense", category: "rent" });
    expect(result.success).toBe(true);
  });

  it("rejects an expense with a category outside the allowed list", () => {
    const result = createTransactionSchema.safeParse({ ...base, type: "expense", category: "made_up_category" });
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
});
