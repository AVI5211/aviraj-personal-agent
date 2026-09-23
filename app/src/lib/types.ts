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

export type LoanStatus = "active" | "closed";
export type LoanPaymentStatus = "scheduled" | "paid";

export interface LoanSummary {
  paidCount: number;
  pendingCount: number;
  totalPaidPaise: number;
  scheduledRemainingPaise: number;
}

export interface LoanApi extends LoanSummary {
  id: string;
  lender: string;
  originalPrincipalPaise: number;
  outstandingPrincipalPaise: number;
  monthlyEmiPaise: number;
  dueDayOfMonth: number;
  startDate: string;
  interestRateAnnualBps: number | null;
  status: LoanStatus;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoanPaymentApi {
  id: string;
  loanId: string;
  dueDate: string;
  amountPaise: number;
  principalPaise: number | null;
  interestPaise: number | null;
  feesPaise: number | null;
  status: LoanPaymentStatus;
  paidDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LoanDetailResponse {
  loan: LoanApi;
  payments: LoanPaymentApi[];
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
