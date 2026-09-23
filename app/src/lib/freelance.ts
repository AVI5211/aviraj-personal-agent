import { ObjectId } from "mongodb";
import type {
  ClientApi,
  ClientCurrency,
  InvoiceApi,
  InvoiceStatus,
  LeadExpenseApi,
  LeadExpenseCategory,
  WorkLogApi,
} from "@/lib/types";

// Rough placeholder rate used only when estimating an unbilled USD client's
// hours in INR for the dashboard snapshot; never used for real settlement math.
export const PLACEHOLDER_USD_TO_INR_RATE = 83;

export interface ClientDoc {
  _id: ObjectId;
  name: string;
  currency: ClientCurrency;
  hourlyRateMinor: number;
  contractNote: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkLogDoc {
  _id: ObjectId;
  clientId: ObjectId;
  date: string;
  billableHours: number;
  nonBillableHours: number;
  description: string;
  invoiced: boolean;
  invoiceId: ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceDoc {
  _id: ObjectId;
  clientId: ObjectId;
  issueDate: string;
  workLogIds: ObjectId[];
  hours: number;
  currency: ClientCurrency;
  grossAmountMinor: number;
  feesMinor: number;
  exchangeRateToInr: number;
  netInrPaise: number;
  status: InvoiceStatus;
  paidDate: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeadExpenseDoc {
  _id: ObjectId;
  date: string;
  amountPaise: number;
  category: LeadExpenseCategory;
  description: string;
  createdAt: Date;
}

export function serializeClient(doc: ClientDoc): ClientApi {
  return {
    id: doc._id.toString(),
    name: doc.name,
    currency: doc.currency,
    hourlyRateMinor: doc.hourlyRateMinor,
    contractNote: doc.contractNote,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function serializeWorkLog(doc: WorkLogDoc): WorkLogApi {
  return {
    id: doc._id.toString(),
    clientId: doc.clientId.toString(),
    date: doc.date,
    billableHours: doc.billableHours,
    nonBillableHours: doc.nonBillableHours,
    description: doc.description,
    invoiced: doc.invoiced,
    invoiceId: doc.invoiceId ? doc.invoiceId.toString() : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function serializeInvoice(doc: InvoiceDoc): InvoiceApi {
  return {
    id: doc._id.toString(),
    clientId: doc.clientId.toString(),
    issueDate: doc.issueDate,
    workLogIds: doc.workLogIds.map((id) => id.toString()),
    hours: doc.hours,
    currency: doc.currency,
    grossAmountMinor: doc.grossAmountMinor,
    feesMinor: doc.feesMinor,
    exchangeRateToInr: doc.exchangeRateToInr,
    netInrPaise: doc.netInrPaise,
    status: doc.status,
    paidDate: doc.paidDate,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function serializeLeadExpense(doc: LeadExpenseDoc): LeadExpenseApi {
  return {
    id: doc._id.toString(),
    date: doc.date,
    amountPaise: doc.amountPaise,
    category: doc.category,
    description: doc.description,
    createdAt: doc.createdAt.toISOString(),
  };
}

/**
 * Computes the gross invoice amount (in the client's currency, minor units)
 * from a set of work logs' billable hours and the client's hourly rate.
 */
export function computeGrossAmountMinor(
  workLogs: { billableHours: number }[],
  hourlyRateMinor: number
): number {
  const totalHours = workLogs.reduce((sum, log) => sum + log.billableHours, 0);
  return Math.round(totalHours * hourlyRateMinor);
}

/**
 * Computes the net INR paise received/estimated from a gross amount (in the
 * client's currency minor units), platform/transfer fees (same minor units),
 * and an exchange rate to INR. For INR clients, pass exchangeRateToInr = 1
 * and the minor units are already paise, so the result is in paise directly.
 */
export function computeNetInrPaise(
  grossAmountMinor: number,
  feesMinor: number,
  exchangeRateToInr: number
): number {
  return Math.round(((grossAmountMinor - feesMinor) * exchangeRateToInr));
}
