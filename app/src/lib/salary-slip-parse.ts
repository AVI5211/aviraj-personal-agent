// Framework-free parsing of payslip text (as extracted from the PDF) into the figures the
// salary slips page stores. Kept pure so it can be unit-tested without a PDF.

export interface ParsedSalarySlip {
  month: string | null; // YYYY-MM
  grossPaise: number | null;
  deductionsPaise: number | null;
  netPayPaise: number | null; // as printed on the slip, used only for the consistency check
  warnings: string[];
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

/** Parses Indian-grouped amounts like "1,79,533.00" into paise. */
function amountToPaise(raw: string): number | null {
  const value = Number(raw.replace(/,/g, ""));
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : null;
}

function findAmount(text: string, label: string): number | null {
  const match = new RegExp(`${label}\\s*:?\\s*(?:Rs\\.?|INR|₹)?\\s*([\\d,]+(?:\\.\\d{1,2})?)`, "i").exec(text);
  return match ? amountToPaise(match[1]) : null;
}

function findMonth(text: string): string | null {
  const match = /(?:month of|for the month)\s*:?\s*([A-Za-z]{3,9})[\s,'-]*(\d{4})/i.exec(text);
  if (!match) return null;
  const month = MONTHS[match[1].toLowerCase().slice(0, match[1].toLowerCase().startsWith("sept") ? 4 : 3)];
  return month ? `${match[2]}-${String(month).padStart(2, "0")}` : null;
}

function formatInr(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function parseSalarySlipText(rawText: string): ParsedSalarySlip {
  const text = rawText.replace(/\s+/g, " ");
  const month = findMonth(text);
  const grossPaise = findAmount(text, "Total Earnings") ?? findAmount(text, "Gross (?:Earnings|Salary|Pay)");
  const deductionsPaise = findAmount(text, "Total Deductions");
  const netPayPaise = findAmount(text, "Net Pay") ?? findAmount(text, "Net Salary");

  const warnings: string[] = [];
  if (!month) warnings.push("Couldn't find the slip month");
  if (grossPaise === null) warnings.push("Couldn't find Total Earnings");
  if (deductionsPaise === null) warnings.push("Couldn't find Total Deductions");
  if (grossPaise !== null && deductionsPaise !== null && netPayPaise !== null && grossPaise - deductionsPaise !== netPayPaise) {
    warnings.push(
      `Slip's Net Pay ${formatInr(netPayPaise)} doesn't match Earnings − Deductions ${formatInr(grossPaise - deductionsPaise)}`
    );
  }

  return { month, grossPaise, deductionsPaise, netPayPaise, warnings };
}
