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
