import { ObjectId } from "mongodb";
import type { SalaryOverviewResponse, SalaryRecordApi, SalaryStatus } from "@/lib/types";

export interface SalaryRecordDoc {
  _id: ObjectId;
  month: string; // YYYY-MM
  grossPaise: number;
  deductionsPaise: number;
  pfEmployeePaise: number;
  pfEmployerPaise: number;
  tdsPaise: number;
  recurringPf: boolean;
  recurringTds: boolean;
  status: SalaryStatus;
  receivedDate: string | null;
  note: string;
  createdAt: Date;
  updatedAt: Date;
}

export function totalDeductionsFor(doc: Pick<SalaryRecordDoc, "deductionsPaise" | "pfEmployeePaise" | "tdsPaise">): number {
  return doc.deductionsPaise + doc.pfEmployeePaise + doc.tdsPaise;
}

export function netPaiseFor(doc: Pick<SalaryRecordDoc, "grossPaise" | "deductionsPaise" | "pfEmployeePaise" | "tdsPaise">): number {
  return doc.grossPaise - totalDeductionsFor(doc);
}

export function ctcPaiseFor(doc: Pick<SalaryRecordDoc, "grossPaise" | "pfEmployerPaise">): number {
  return doc.grossPaise + doc.pfEmployerPaise;
}

export function serializeSalaryRecord(doc: SalaryRecordDoc): SalaryRecordApi {
  return {
    id: doc._id.toString(),
    month: doc.month,
    grossPaise: doc.grossPaise,
    deductionsPaise: doc.deductionsPaise,
    pfEmployeePaise: doc.pfEmployeePaise,
    pfEmployerPaise: doc.pfEmployerPaise,
    tdsPaise: doc.tdsPaise,
    recurringPf: doc.recurringPf,
    recurringTds: doc.recurringTds,
    totalDeductionsPaise: totalDeductionsFor(doc),
    ctcPaise: ctcPaiseFor(doc),
    netPaise: netPaiseFor(doc),
    status: doc.status,
    receivedDate: doc.receivedDate,
    note: doc.note,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function computeSalaryOverview(
  records: Pick<
    SalaryRecordDoc,
    "grossPaise" | "deductionsPaise" | "pfEmployeePaise" | "pfEmployerPaise" | "tdsPaise"
  >[]
): SalaryOverviewResponse {
  let totalGrossPaise = 0;
  let totalPfEmployeePaise = 0;
  let totalPfEmployerPaise = 0;
  let totalTdsPaise = 0;
  let totalOtherDeductionsPaise = 0;

  for (const record of records) {
    totalGrossPaise += record.grossPaise;
    totalPfEmployeePaise += record.pfEmployeePaise;
    totalPfEmployerPaise += record.pfEmployerPaise;
    totalTdsPaise += record.tdsPaise;
    totalOtherDeductionsPaise += record.deductionsPaise;
  }

  const totalDeductionsPaise = totalPfEmployeePaise + totalTdsPaise + totalOtherDeductionsPaise;

  return {
    totalGrossPaise,
    totalCtcPaise: totalGrossPaise + totalPfEmployerPaise,
    totalInHandPaise: totalGrossPaise - totalDeductionsPaise,
    totalPfEmployeePaise,
    totalPfEmployerPaise,
    totalTdsPaise,
    totalOtherDeductionsPaise,
    totalDeductionsPaise,
    totalTaxPaidPaise: totalTdsPaise,
    recordCount: records.length,
  };
}
