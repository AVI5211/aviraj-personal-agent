export type Module = "shop" | "personal";
export type TransactionType = "income" | "expense";
export type PaymentMethod = "bharatpe" | "cash" | "bank_transfer" | "other";
export type Period = "today" | "week" | "month" | "lastMonth" | "year" | "custom" | "all";
export type AccountType = "bank" | "cash" | "investment" | "pf" | "other_asset" | "loan";
export type SalaryStatus = "expected" | "received";

export interface TransactionApi {
  id: string;
  module: Module;
  type: TransactionType;
  amountPaise: number;
  category: string;
  paymentMethod: PaymentMethod;
  source: string;
  transactionDate: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionListResponse {
  transactions: TransactionApi[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SummaryResponse {
  range: { from: string | null; to: string | null };
  totalIncome: number;
  totalExpense: number;
  netCashFlow: number;
  openingBalance: number;
  closingBalance: number;
  incomeByMethod: Record<string, number>;
  expenseByMethod: Record<string, number>;
  expenseByCategory: Record<string, number>;
}

export interface TrendPoint {
  month: string;
  income: number;
  expense: number;
}

export interface AccountApi {
  id: string;
  name: string;
  type: AccountType;
  balancePaise: number;
  updatedAt: string;
}

export interface SalaryRecordApi {
  id: string;
  month: string;
  grossPaise: number;
  deductionsPaise: number;
  netPaise: number;
  status: SalaryStatus;
  receivedDate: string | null;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export type ClientCurrency = "USD" | "INR";
export type InvoiceStatus = "issued" | "paid";
export type LeadExpenseCategory = "upwork_connects" | "subscription" | "other";

export interface ClientApi {
  id: string;
  name: string;
  currency: ClientCurrency;
  hourlyRateMinor: number;
  contractNote: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkLogApi {
  id: string;
  clientId: string;
  date: string;
  billableHours: number;
  nonBillableHours: number;
  description: string;
  invoiced: boolean;
  invoiceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceApi {
  id: string;
  clientId: string;
  issueDate: string;
  workLogIds: string[];
  hours: number;
  currency: ClientCurrency;
  grossAmountMinor: number;
  feesMinor: number;
  exchangeRateToInr: number;
  netInrPaise: number;
  status: InvoiceStatus;
  paidDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadExpenseApi {
  id: string;
  date: string;
  amountPaise: number;
  category: LeadExpenseCategory;
  description: string;
  createdAt: string;
}

export interface FreelanceSummaryResponse {
  range: { from: string | null; to: string | null };
  receivedPaise: number;
  pendingPaise: number;
  unbilledHours: number;
  unbilledAmountEstimatePaise: number;
  leadExpensesPaise: number;
}

export interface AdminOverviewResponse {
  range: { from: string | null; to: string | null };
  netWorth: number;
  cashAndBank: number;
  investmentsTotal: number;
  pfTotal: number;
  otherAssetsTotal: number;
  liabilitiesTotal: number;
  monthlyIncome: number;
  monthlyExpense: number;
  incomeSources: {
    salary: number;
    shop: number;
    freelance: number;
  };
  shopNetCashFlow: number;
  receivables: number;
}
