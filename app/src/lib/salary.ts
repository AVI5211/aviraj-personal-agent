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
  // Employer-side CTC components that never appear on the payslip's earnings/deductions
  // table and never touch the employee's hand — e.g. group health insurance premium,
  // gym/wellness allowance paid directly by the employer. Affects CTC only.
  otherCtcComponentsPaise: number;
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

export function ctcPaiseFor(
  doc: Pick<SalaryRecordDoc, "grossPaise" | "pfEmployerPaise" | "otherCtcComponentsPaise">
): number {
  // otherCtcComponentsPaise was added after some records already existed in the database;
  // treat a missing value as 0 rather than propagating NaN into the UI.
  return doc.grossPaise + doc.pfEmployerPaise + (doc.otherCtcComponentsPaise ?? 0);
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
    otherCtcComponentsPaise: doc.otherCtcComponentsPaise,
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
    "grossPaise" | "deductionsPaise" | "pfEmployeePaise" | "pfEmployerPaise" | "tdsPaise" | "otherCtcComponentsPaise"
  >[]
): SalaryOverviewResponse {
  let totalGrossPaise = 0;
  let totalPfEmployeePaise = 0;
  let totalPfEmployerPaise = 0;
  let totalTdsPaise = 0;
  let totalOtherDeductionsPaise = 0;
  let totalOtherCtcComponentsPaise = 0;

  for (const record of records) {
    totalGrossPaise += record.grossPaise;
    totalPfEmployeePaise += record.pfEmployeePaise;
    totalPfEmployerPaise += record.pfEmployerPaise;
    totalTdsPaise += record.tdsPaise;
    totalOtherDeductionsPaise += record.deductionsPaise;
    totalOtherCtcComponentsPaise += record.otherCtcComponentsPaise ?? 0;
  }

  const totalDeductionsPaise = totalPfEmployeePaise + totalTdsPaise + totalOtherDeductionsPaise;

  return {
    totalGrossPaise,
    totalCtcPaise: totalGrossPaise + totalPfEmployerPaise + totalOtherCtcComponentsPaise,
    totalInHandPaise: totalGrossPaise - totalDeductionsPaise,
    totalPfEmployeePaise,
    totalPfEmployerPaise,
    totalTdsPaise,
    totalOtherDeductionsPaise,
    totalOtherCtcComponentsPaise,
    totalDeductionsPaise,
    totalTaxPaidPaise: totalTdsPaise,
    recordCount: records.length,
  };
}
