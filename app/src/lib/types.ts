export type TransactionType = "income" | "expense";
export type PaymentMethod = "bharatpe" | "cash" | "bank_transfer" | "other";
export type Period = "today" | "week" | "month" | "lastMonth" | "year" | "custom" | "all";

export interface TransactionApi {
  id: string;
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
