import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { updateLoanSchema } from "@/lib/validation";
import { computeLoanSummary, serializeLoan, serializeLoanPayment, type LoanDoc, type LoanPaymentDoc } from "@/lib/loans";
import { parseObjectId } from "@/lib/transactions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
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

  const payments = await db
    .collection<LoanPaymentDoc>("loan_payments")
    .find({ loanId: objectId })
    .sort({ dueDate: 1 })
    .toArray();

  const summary = computeLoanSummary(loan, payments);

  return NextResponse.json({
    loan: serializeLoan(loan, summary),
    payments: payments.map(serializeLoanPayment),
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const objectId = parseObjectId(id);
  if (!objectId) {
    return NextResponse.json({ error: "Invalid loan id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateLoanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.collection<LoanDoc>("loans").findOneAndUpdate(
    { _id: objectId },
    { $set: { ...parsed.data, updatedAt: new Date() } },
    { returnDocument: "after" }
  );

  if (!result) {
    return NextResponse.json({ error: "Loan not found" }, { status: 404 });
  }

  const payments = await db
    .collection<LoanPaymentDoc>("loan_payments")
    .find({ loanId: objectId })
    .project<{ status: LoanPaymentDoc["status"]; amountPaise: number }>({ status: 1, amountPaise: 1 })
    .toArray();
  const summary = computeLoanSummary(result, payments);

  return NextResponse.json(serializeLoan(result, summary));
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const objectId = parseObjectId(id);
  if (!objectId) {
    return NextResponse.json({ error: "Invalid loan id" }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.collection<LoanDoc>("loans").deleteOne({ _id: objectId });

  if (result.deletedCount === 0) {
    return NextResponse.json({ error: "Loan not found" }, { status: 404 });
  }

  await db.collection("loan_payments").deleteMany({ loanId: objectId });

  return NextResponse.json({ ok: true });
}
