import { ObjectId } from "mongodb";
import type { LoanApi, LoanPaymentApi, LoanPaymentStatus, LoanStatus, LoanSummary } from "@/lib/types";

export interface LoanDoc {
  _id: ObjectId;
  lender: string;
  originalPrincipalPaise: number;
  outstandingPrincipalPaise: number;
  monthlyEmiPaise: number;
  dueDayOfMonth: number;
  startDate: string;
  interestRateAnnualBps: number | null;
  status: LoanStatus;
  note: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoanPaymentDoc {
  _id: ObjectId;
  loanId: ObjectId;
  dueDate: string;
  amountPaise: number;
  principalPaise: number | null;
  interestPaise: number | null;
  feesPaise: number | null;
  status: LoanPaymentStatus;
  paidDate: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function serializeLoan(doc: LoanDoc, summary: LoanSummary): LoanApi {
  return {
    id: doc._id.toString(),
    lender: doc.lender,
    originalPrincipalPaise: doc.originalPrincipalPaise,
    outstandingPrincipalPaise: doc.outstandingPrincipalPaise,
    monthlyEmiPaise: doc.monthlyEmiPaise,
    dueDayOfMonth: doc.dueDayOfMonth,
    startDate: doc.startDate,
    interestRateAnnualBps: doc.interestRateAnnualBps,
    status: doc.status,
    note: doc.note,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    ...summary,
  };
}

export function serializeLoanPayment(doc: LoanPaymentDoc): LoanPaymentApi {
  return {
    id: doc._id.toString(),
    loanId: doc.loanId.toString(),
    dueDate: doc.dueDate,
    amountPaise: doc.amountPaise,
    principalPaise: doc.principalPaise,
    interestPaise: doc.interestPaise,
    feesPaise: doc.feesPaise,
    status: doc.status,
    paidDate: doc.paidDate,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

interface PaymentForSummary {
  status: LoanPaymentStatus;
  amountPaise: number;
}

/**
 * Pure calculation: derives paid/pending installment counts and totals from a loan's
 * monthlyEmiPaise and its payments. "scheduledRemainingPaise" is a projection
 * (pendingCount * monthlyEmiPaise), NOT the true outstanding principal.
 */
export function computeLoanSummary(
  loan: { monthlyEmiPaise: number },
  payments: PaymentForSummary[]
): LoanSummary {
  let paidCount = 0;
  let pendingCount = 0;
  let totalPaidPaise = 0;

  for (const payment of payments) {
    if (payment.status === "paid") {
      paidCount += 1;
      totalPaidPaise += payment.amountPaise;
    } else {
      pendingCount += 1;
    }
  }

  return {
    paidCount,
    pendingCount,
    totalPaidPaise,
    scheduledRemainingPaise: pendingCount * loan.monthlyEmiPaise,
  };
}

export function addMonthsToDateString(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + months, d));
  const yy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
