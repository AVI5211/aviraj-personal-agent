import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { generateLoanPaymentsSchema } from "@/lib/validation";
import { addMonthsToDateString, serializeLoanPayment, type LoanDoc, type LoanPaymentDoc } from "@/lib/loans";
import { parseObjectId } from "@/lib/transactions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Convenience: generates the next N scheduled installments at monthlyEmiPaise, spaced one
// month apart starting the month after the last existing payment's due date (or startDate
// if none exist). Skips any due date that already has a scheduled payment.
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const objectId = parseObjectId(id);
  if (!objectId) {
    return NextResponse.json({ error: "Invalid loan id" }, { status: 400 });
  }

  const db = await getDb();
  const loan = await db.collection<LoanDoc>("loans").findOne({ _id: objectId });
  if (!loan) {
    return NextResponse.json({ error: "Loan not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = generateLoanPaymentsSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { months } = parsed.data;

  const existingPayments = await db
    .collection<LoanPaymentDoc>("loan_payments")
    .find({ loanId: objectId })
    .sort({ dueDate: -1 })
    .toArray();

  const existingDueDates = new Set(existingPayments.map((p) => p.dueDate));
  let cursor = existingPayments.length > 0 ? existingPayments[0].dueDate : loan.startDate;

  const now = new Date();
  const toInsert: Omit<LoanPaymentDoc, "_id">[] = [];

  for (let i = 0; i < months; i++) {
    cursor = addMonthsToDateString(cursor, 1);
    if (existingDueDates.has(cursor)) continue;
    toInsert.push({
      loanId: objectId,
      dueDate: cursor,
      amountPaise: loan.monthlyEmiPaise,
      principalPaise: null,
      interestPaise: null,
      feesPaise: null,
      status: "scheduled",
      paidDate: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  if (toInsert.length === 0) {
    return NextResponse.json({ payments: [] });
  }

  const result = await db.collection("loan_payments").insertMany(toInsert);
  const inserted = toInsert.map((doc, index) => serializeLoanPayment({ _id: result.insertedIds[index], ...doc }));

  return NextResponse.json({ payments: inserted }, { status: 201 });
}
