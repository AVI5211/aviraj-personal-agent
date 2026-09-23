import { ObjectId } from "mongodb";
import type { TransactionApi, TransactionType, PaymentMethod } from "@/lib/types";

export interface TransactionDoc {
  _id: ObjectId;
  type: TransactionType;
  amountPaise: number;
  category: string;
  paymentMethod: PaymentMethod;
  source: string;
  transactionDate: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export function serializeTransaction(doc: TransactionDoc): TransactionApi {
  return {
    id: doc._id.toString(),
    type: doc.type,
    amountPaise: doc.amountPaise,
    category: doc.category,
    paymentMethod: doc.paymentMethod,
    source: doc.source,
    transactionDate: doc.transactionDate,
    description: doc.description,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function buildDateRangeFilter(from?: string | null, to?: string | null): Record<string, unknown> {
  if (!from && !to) return {};
  const range: Record<string, string> = {};
  if (from) range.$gte = from;
  if (to) range.$lte = to;
  return { transactionDate: range };
}

export function parseObjectId(id: string): ObjectId | null {
  if (!ObjectId.isValid(id)) return null;
  return new ObjectId(id);
}
