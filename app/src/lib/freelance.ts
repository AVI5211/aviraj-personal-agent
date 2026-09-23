import { ObjectId } from "mongodb";
import type {
  ClientApi,
  ClientCurrency,
  EpicApi,
  InvoiceApi,
  InvoiceStatus,
  LeadExpenseApi,
  LeadExpenseCategory,
  PaymentPlatform,
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

export interface EpicDoc {
  _id: ObjectId;
  clientId: ObjectId;
  name: string;
  createdAt: Date;
}

export interface WorkLogDoc {
  _id: ObjectId;
  clientId: ObjectId;
  epicId: ObjectId | null;
  date: string;
  billableHours: number;
  nonBillableHours: number;
  description: string;
  notes: string;
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
  paymentPlatform: PaymentPlatform;
  grossAmountMinor: number;
  feesMinor: number;
  exchangeRateToInr: number;
  netInrPaise: number;
  taxPaidPaise: number;
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

export function serializeEpic(doc: EpicDoc): EpicApi {
  return {
    id: doc._id.toString(),
    clientId: doc.clientId.toString(),
    name: doc.name,
    createdAt: doc.createdAt.toISOString(),
  };
}

export function serializeWorkLog(doc: WorkLogDoc): WorkLogApi {
  return {
    id: doc._id.toString(),
    clientId: doc.clientId.toString(),
    epicId: doc.epicId ? doc.epicId.toString() : null,
    date: doc.date,
    billableHours: doc.billableHours,
    nonBillableHours: doc.nonBillableHours,
    description: doc.description,
    notes: doc.notes,
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
    paymentPlatform: doc.paymentPlatform,
    grossAmountMinor: doc.grossAmountMinor,
    feesMinor: doc.feesMinor,
    exchangeRateToInr: doc.exchangeRateToInr,
    netInrPaise: doc.netInrPaise,
    taxPaidPaise: doc.taxPaidPaise,
    inHandPaise: computeInHandPaise(doc.netInrPaise, doc.taxPaidPaise),
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

/** In-hand amount after tax withheld/paid on an invoice's net INR settlement. */
export function computeInHandPaise(netInrPaise: number, taxPaidPaise: number): number {
  return netInrPaise - taxPaidPaise;
}

function roundHours(hours: number): number {
  return Math.round(hours * 100) / 100;
}

export interface AllocatableLog {
  id: string;
  billableHours: number;
}

export interface PartialSplit {
  id: string;
  paidHours: number;
  leftoverHours: number;
}

export interface HourAllocation {
  /** Log IDs consumed in full by this allocation. */
  fullyConsumedIds: string[];
  /** The one entry straddling the boundary, if any, split into a paid part and a leftover part. */
  partialSplit: PartialSplit | null;
  /** Hours actually allocated — equals targetHours unless the logs didn't have enough unbilled hours. */
  invoicedHours: number;
}

/**
 * Allocates a flat number of hours against a list of unbilled work-log entries,
 * oldest first, regardless of which epic each entry belongs to. Entries that fit
 * entirely within the remaining target are consumed whole; the one entry that
 * would overshoot the target is split into a paid portion and a leftover portion
 * so the pool never goes negative and no epic/entry is invoiced past its own hours.
 */
export function allocateHoursFifo(logs: AllocatableLog[], targetHours: number): HourAllocation {
  const fullyConsumedIds: string[] = [];
  let partialSplit: PartialSplit | null = null;
  let remaining = roundHours(targetHours);

  for (const log of logs) {
    if (remaining <= 1e-9) break;

    if (log.billableHours <= remaining + 1e-9) {
      fullyConsumedIds.push(log.id);
      remaining = roundHours(remaining - log.billableHours);
    } else {
      const paidHours = roundHours(remaining);
      const leftoverHours = roundHours(log.billableHours - paidHours);
      partialSplit = { id: log.id, paidHours, leftoverHours };
      remaining = 0;
    }
  }

  return {
    fullyConsumedIds,
    partialSplit,
    invoicedHours: roundHours(targetHours - remaining),
  };
}
