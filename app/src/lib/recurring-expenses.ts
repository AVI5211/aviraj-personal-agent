import { ObjectId } from "mongodb";
import type { RecurringExpenseApi } from "@/lib/types";

export interface RecurringExpenseDoc {
  _id: ObjectId;
  name: string;
  monthlyAmountPaise: number;
  dueDayOfMonth: number;
  startDate: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function serializeRecurringExpense(doc: RecurringExpenseDoc): RecurringExpenseApi {
  return {
    id: doc._id.toString(),
    name: doc.name,
    monthlyAmountPaise: doc.monthlyAmountPaise,
    dueDayOfMonth: doc.dueDayOfMonth,
    startDate: doc.startDate,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
