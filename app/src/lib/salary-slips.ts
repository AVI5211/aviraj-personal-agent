import type { Binary, ObjectId } from "mongodb";
import type { SalarySlipApi } from "@/lib/types";

// Kept well under MongoDB's 16 MB document limit; payslip PDFs are typically ~200 KB.
export const MAX_SALARY_SLIP_BYTES = 5 * 1024 * 1024;

export interface SalarySlipDoc {
  _id: ObjectId;
  month: string; // YYYY-MM, one slip per month
  grossPaise: number;
  deductionsPaise: number;
  fileName: string;
  sizeBytes: number;
  data: Binary;
  createdAt: Date;
  updatedAt: Date;
}

export function isValidMonth(value: string): boolean {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  return !!match && Number(match[2]) >= 1 && Number(match[2]) <= 12;
}

/** Checks the file's own header rather than trusting the browser-supplied MIME type. */
export function looksLikePdf(bytes: Uint8Array): boolean {
  return bytes.length > 5 && String.fromCharCode(...bytes.subarray(0, 5)) === "%PDF-";
}

export function serializeSalarySlip(doc: Omit<SalarySlipDoc, "data">): SalarySlipApi {
  return {
    id: doc._id.toString(),
    month: doc.month,
    grossPaise: doc.grossPaise,
    deductionsPaise: doc.deductionsPaise,
    netPaise: doc.grossPaise - doc.deductionsPaise,
    fileName: doc.fileName,
    sizeBytes: doc.sizeBytes,
    updatedAt: doc.updatedAt.toISOString(),
  };
}
