import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { createLoanSchema } from "@/lib/validation";
import { computeLoanSummary, serializeLoan, type LoanDoc, type LoanPaymentDoc } from "@/lib/loans";

export async function GET() {
  const db = await getDb();
  const loans = await db.collection<LoanDoc>("loans").find({}).sort({ createdAt: -1 }).toArray();

  const result = await Promise.all(
    loans.map(async (loan) => {
      const payments = await db
        .collection<LoanPaymentDoc>("loan_payments")
        .find({ loanId: loan._id })
        .project<{ status: LoanPaymentDoc["status"]; amountPaise: number }>({ status: 1, amountPaise: 1 })
        .toArray();
      const summary = computeLoanSummary(loan, payments);
      return serializeLoan(loan, summary);
    })
  );

  return NextResponse.json({ loans: result });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = createLoanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const now = new Date();
  const data = parsed.data;
  const doc = {
    lender: data.lender,
    originalPrincipalPaise: data.originalPrincipalPaise,
    outstandingPrincipalPaise: data.outstandingPrincipalPaise ?? data.originalPrincipalPaise,
    monthlyEmiPaise: data.monthlyEmiPaise,
    dueDayOfMonth: data.dueDayOfMonth,
    startDate: data.startDate,
    interestRateAnnualBps: data.interestRateAnnualBps,
    status: data.status,
    note: data.note,
    createdAt: now,
    updatedAt: now,
  };

  const db = await getDb();
  const result = await db.collection("loans").insertOne(doc);

  const summary = computeLoanSummary(doc, []);
  return NextResponse.json(serializeLoan({ _id: result.insertedId, ...doc }, summary), { status: 201 });
}
