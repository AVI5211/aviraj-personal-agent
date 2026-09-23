import { ObjectId } from "mongodb";
import type { SalaryRecordApi, SalaryStatus } from "@/lib/types";

export interface SalaryRecordDoc {
  _id: ObjectId;
  month: string; // YYYY-MM
  grossPaise: number;
  deductionsPaise: number;
  status: SalaryStatus;
  receivedDate: string | null;
  note: string;
  createdAt: Date;
  updatedAt: Date;
}

export function serializeSalaryRecord(doc: SalaryRecordDoc): SalaryRecordApi {
  return {
    id: doc._id.toString(),
    month: doc.month,
    grossPaise: doc.grossPaise,
    deductionsPaise: doc.deductionsPaise,
    netPaise: doc.grossPaise - doc.deductionsPaise,
    status: doc.status,
    receivedDate: doc.receivedDate,
    note: doc.note,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
