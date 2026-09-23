import { z } from "zod";
import { isValidDateString } from "@/lib/dates";

export const MODULES = ["shop", "personal"] as const;
export const PAYMENT_METHODS = ["bharatpe", "cash", "bank_transfer", "other"] as const;
export const SHOP_EXPENSE_CATEGORIES = [
  "stock",
  "rent",
  "electricity",
  "salary",
  "transport",
  "labor",
  "renovation",
  "maintenance",
  "equipment",
  "marketing",
  "packaging",
  "insurance",
  "fees_taxes",
  "other",
] as const;
export const PERSONAL_EXPENSE_CATEGORIES = [
  "groceries",
  "rent",
  "utilities",
  "transport",
  "health",
  "entertainment",
  "shopping",
  "other",
] as const;
// Personal income with this category represents money drawn from the shop into personal
// funds — the only shop-related figure that should count as personal income, so shop
// turnover is never double-counted as personal earnings.
export const SHOP_DRAW_CATEGORY = "shop_draw";
export const INCOME_CATEGORY_DEFAULT = "shop_sales";

const dateString = z.string().refine(isValidDateString, { message: "must be a valid YYYY-MM-DD date" });

function expenseCategoriesFor(moduleName: string): readonly string[] {
  return moduleName === "shop" ? SHOP_EXPENSE_CATEGORIES : PERSONAL_EXPENSE_CATEGORIES;
}

export const createTransactionSchema = z
  .object({
    module: z.enum(MODULES),
    type: z.enum(["income", "expense"]),
    amountPaise: z.number().int().positive(),
    category: z.string().min(1).max(50),
    paymentMethod: z.enum(PAYMENT_METHODS),
    transactionDate: dateString,
    description: z.string().max(500).default(""),
  })
  .superRefine((data, ctx) => {
    if (data.type === "expense" && !expenseCategoriesFor(data.module).includes(data.category)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `category must be one of: ${expenseCategoriesFor(data.module).join(", ")}`,
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
  module: z.enum(MODULES).default("shop"),
  from: dateString.optional(),
  to: dateString.optional(),
  type: z.enum(["income", "expense"]).optional(),
  category: z.string().optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export const periodQuerySchema = z.object({
  module: z.enum(MODULES).default("shop"),
  period: z.enum(["today", "week", "month", "lastMonth", "year", "custom", "all"]),
  from: dateString.optional(),
  to: dateString.optional(),
});

export const loginSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200),
});

export const trendsQuerySchema = z.object({
  module: z.enum(MODULES).default("shop"),
  months: z.coerce.number().int().min(1).max(36).default(12),
});

export const openingBalanceSchema = z.object({
  amountPaise: z.number().int().min(0),
});

export const ACCOUNT_TYPES = ["bank", "cash", "investment", "pf", "other_asset", "loan"] as const;
export const LIABILITY_ACCOUNT_TYPES = ["loan"] as const;

export const createAccountSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(ACCOUNT_TYPES),
  balancePaise: z.number().int().min(0),
});

export const updateAccountSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    balancePaise: z.number().int().min(0).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "at least one field must be provided" });

export const salaryStatuses = ["expected", "received"] as const;

export const createSalaryRecordSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "must be in YYYY-MM format"),
  grossPaise: z.number().int().positive(),
  deductionsPaise: z.number().int().min(0).default(0),
  pfEmployeePaise: z.number().int().min(0).default(0),
  pfEmployerPaise: z.number().int().min(0).default(0),
  tdsPaise: z.number().int().min(0).default(0),
  recurringPf: z.boolean().default(false),
  recurringTds: z.boolean().default(false),
  status: z.enum(salaryStatuses).default("expected"),
  receivedDate: dateString.optional(),
  note: z.string().max(300).default(""),
});

export const updateSalaryRecordSchema = z
  .object({
    grossPaise: z.number().int().positive().optional(),
    deductionsPaise: z.number().int().min(0).optional(),
    pfEmployeePaise: z.number().int().min(0).optional(),
    pfEmployerPaise: z.number().int().min(0).optional(),
    tdsPaise: z.number().int().min(0).optional(),
    recurringPf: z.boolean().optional(),
    recurringTds: z.boolean().optional(),
    status: z.enum(salaryStatuses).optional(),
    receivedDate: dateString.optional(),
    note: z.string().max(300).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "at least one field must be provided" });

export const investmentHoldingTypes = ["equity", "mutual_fund", "fixed_deposit", "savings", "other"] as const;

export const createInvestmentSchema = z.object({
  name: z.string().min(1).max(150),
  holdingType: z.enum(investmentHoldingTypes),
  currentValuePaise: z.number().int().min(0),
  investedValuePaise: z.number().int().min(0).nullable().default(null),
  valuationDate: dateString,
  maturityDate: dateString.nullable().default(null),
  interestRateAnnualBps: z.number().int().min(0).max(100_000).nullable().default(null),
  note: z.string().max(300).default(""),
});

export const updateInvestmentSchema = z
  .object({
    name: z.string().min(1).max(150).optional(),
    holdingType: z.enum(investmentHoldingTypes).optional(),
    currentValuePaise: z.number().int().min(0).optional(),
    investedValuePaise: z.number().int().min(0).nullable().optional(),
    valuationDate: dateString.optional(),
    maturityDate: dateString.nullable().optional(),
    interestRateAnnualBps: z.number().int().min(0).max(100_000).nullable().optional(),
    note: z.string().max(300).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "at least one field must be provided" });
export const loanStatuses = ["active", "closed"] as const;
export const loanPaymentStatuses = ["scheduled", "paid"] as const;

export const createLoanSchema = z.object({
  lender: z.string().min(1).max(100),
  originalPrincipalPaise: z.number().int().positive(),
  outstandingPrincipalPaise: z.number().int().min(0).optional(),
  monthlyEmiPaise: z.number().int().positive(),
  dueDayOfMonth: z.number().int().min(1).max(31),
  startDate: dateString,
  interestRateAnnualBps: z.number().int().min(0).max(10000).nullable().default(null),
  status: z.enum(loanStatuses).default("active"),
  note: z.string().max(500).default(""),
});

export const updateLoanSchema = z
  .object({
    lender: z.string().min(1).max(100).optional(),
    monthlyEmiPaise: z.number().int().positive().optional(),
    dueDayOfMonth: z.number().int().min(1).max(31).optional(),
    interestRateAnnualBps: z.number().int().min(0).max(10000).nullable().optional(),
    status: z.enum(loanStatuses).optional(),
    note: z.string().max(500).optional(),
    outstandingPrincipalPaise: z.number().int().min(0).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "at least one field must be provided" });

export const createLoanPaymentSchema = z.object({
  dueDate: dateString,
  amountPaise: z.number().int().positive().optional(),
  principalPaise: z.number().int().min(0).nullable().optional(),
  interestPaise: z.number().int().min(0).nullable().optional(),
  feesPaise: z.number().int().min(0).nullable().optional(),
});

export const markLoanPaymentPaidSchema = z.object({
  paidDate: dateString,
  amountPaise: z.number().int().positive(),
  principalPaise: z.number().int().min(0).nullable().optional(),
  interestPaise: z.number().int().min(0).nullable().optional(),
  feesPaise: z.number().int().min(0).nullable().optional(),
});

export const generateLoanPaymentsSchema = z.object({
  months: z.number().int().min(1).max(60).default(12),
});

// --- Freelance module ---

export const CLIENT_CURRENCIES = ["USD", "INR"] as const;
export const LEAD_EXPENSE_CATEGORIES = ["upwork_connects", "subscription", "other"] as const;
export const INVOICE_STATUSES = ["issued", "paid"] as const;
export const PAYMENT_PLATFORMS = ["upwork", "deel", "other"] as const;

export const createClientSchema = z.object({
  name: z.string().min(1).max(100),
  currency: z.enum(CLIENT_CURRENCIES),
  hourlyRateMinor: z.number().int().positive(),
  contractNote: z.string().max(1000).default(""),
});

export const updateClientSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    currency: z.enum(CLIENT_CURRENCIES).optional(),
    hourlyRateMinor: z.number().int().positive().optional(),
    contractNote: z.string().max(1000).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "at least one field must be provided" });

export const createWorkLogSchema = z.object({
  clientId: z.string().min(1),
  epicId: z.string().min(1).nullable().default(null),
  date: dateString,
  billableHours: z.number().min(0),
  nonBillableHours: z.number().min(0).default(0),
  description: z.string().max(500).default(""),
  notes: z.string().max(1000).default(""),
});

export const updateWorkLogSchema = z
  .object({
    epicId: z.string().min(1).nullable().optional(),
    date: dateString.optional(),
    billableHours: z.number().min(0).optional(),
    nonBillableHours: z.number().min(0).optional(),
    description: z.string().max(500).optional(),
    notes: z.string().max(1000).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "at least one field must be provided" });

export const listWorkLogsQuerySchema = z.object({
  clientId: z.string().optional(),
  invoiced: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

export const createInvoiceSchema = z.object({
  clientId: z.string().min(1),
  workLogIds: z.array(z.string().min(1)).min(1),
  paymentPlatform: z.enum(PAYMENT_PLATFORMS).default("other"),
  feesMinor: z.number().int().min(0).default(0),
  exchangeRateToInr: z.number().positive(),
});

export const updateInvoiceSchema = z.object({
  status: z.literal("paid"),
  netInrPaise: z.number().int().min(0),
  taxPaidPaise: z.number().int().min(0).default(0),
  paidDate: dateString,
});

export const createQuickInvoiceSchema = z.object({
  clientId: z.string().min(1),
  hours: z.number().positive(),
  paymentPlatform: z.enum(PAYMENT_PLATFORMS).default("other"),
  feesMinor: z.number().int().min(0).default(0),
  exchangeRateToInr: z.number().positive(),
  taxPercent: z.number().min(0).max(100).default(0),
  markPaid: z.boolean().default(true),
});

export const listInvoicesQuerySchema = z.object({
  clientId: z.string().optional(),
  status: z.enum(INVOICE_STATUSES).optional(),
});

export const createLeadExpenseSchema = z.object({
  date: dateString,
  amountPaise: z.number().int().positive(),
  category: z.enum(LEAD_EXPENSE_CATEGORIES),
  description: z.string().max(500).default(""),
});

export const importWorkLogRowSchema = z.object({
  epicName: z.string().min(1).max(150),
  description: z.string().max(500).default(""),
  hours: z.number().positive(),
  date: dateString,
  notes: z.string().max(1000).default(""),
});

export const importWorkLogsSchema = z.object({
  clientId: z.string().min(1),
  dryRun: z.boolean().default(false),
  rows: z.array(importWorkLogRowSchema).min(1).max(2000),
});

export const createEpicSchema = z.object({
  clientId: z.string().min(1),
  name: z.string().min(1).max(150),
});

export const setExchangeRateSchema = z.object({
  rate: z.number().positive().max(1000),
});

export const freelanceSummaryQuerySchema = z.object({
  period: z.enum(["today", "week", "month", "lastMonth", "year", "custom", "all"]),
  from: dateString.optional(),
  to: dateString.optional(),
});
