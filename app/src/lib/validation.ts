import { z } from "zod";
import { isValidDateString } from "@/lib/dates";

export const PAYMENT_METHODS = ["bharatpe", "cash", "bank_transfer", "other"] as const;
export const EXPENSE_CATEGORIES = ["stock", "rent", "electricity", "salary", "transport", "other"] as const;
export const INCOME_CATEGORY_DEFAULT = "shop_sales";

const dateString = z.string().refine(isValidDateString, { message: "must be a valid YYYY-MM-DD date" });

export const createTransactionSchema = z
  .object({
    type: z.enum(["income", "expense"]),
    amountPaise: z.number().int().positive(),
    category: z.string().min(1).max(50),
    paymentMethod: z.enum(PAYMENT_METHODS),
    transactionDate: dateString,
    description: z.string().max(500).default(""),
  })
  .superRefine((data, ctx) => {
    if (data.type === "expense" && !EXPENSE_CATEGORIES.includes(data.category as (typeof EXPENSE_CATEGORIES)[number])) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `category must be one of: ${EXPENSE_CATEGORIES.join(", ")}`,
        path: ["category"],
      });
    }
  });

export const updateTransactionSchema = z
  .object({
    amountPaise: z.number().int().positive().optional(),
    category: z.string().min(1).max(50).optional(),
    paymentMethod: z.enum(PAYMENT_METHODS).optional(),
    transactionDate: dateString.optional(),
    description: z.string().max(500).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "at least one field must be provided" });

export const listTransactionsQuerySchema = z.object({
  from: dateString.optional(),
  to: dateString.optional(),
  type: z.enum(["income", "expense"]).optional(),
  category: z.string().optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export const periodQuerySchema = z.object({
  period: z.enum(["today", "week", "month", "lastMonth", "year", "custom", "all"]),
  from: dateString.optional(),
  to: dateString.optional(),
});

export const loginSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200),
});

export const trendsQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(36).default(12),
});

export const openingBalanceSchema = z.object({
  amountPaise: z.number().int().min(0),
});
