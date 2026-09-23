import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { markLoanPaymentPaidSchema } from "@/lib/validation";
import { serializeLoanPayment, type LoanPaymentDoc } from "@/lib/loans";
import { parseObjectId } from "@/lib/transactions";

interface RouteParams {
  params: Promise<{ id: string; paymentId: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id, paymentId } = await params;
  const loanId = parseObjectId(id);
  const objectId = parseObjectId(paymentId);
  if (!loanId || !objectId) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = markLoanPaymentPaidSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = await getDb();
  const data = parsed.data;
  const result = await db.collection<LoanPaymentDoc>("loan_payments").findOneAndUpdate(
    { _id: objectId, loanId },
    {
      $set: {
        status: "paid",
        paidDate: data.paidDate,
        amountPaise: data.amountPaise,
        principalPaise: data.principalPaise ?? null,
        interestPaise: data.interestPaise ?? null,
        feesPaise: data.feesPaise ?? null,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  );

  if (!result) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  return NextResponse.json(serializeLoanPayment(result));
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id, paymentId } = await params;
  const loanId = parseObjectId(id);
  const objectId = parseObjectId(paymentId);
  if (!loanId || !objectId) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const db = await getDb();
  const payment = await db.collection<LoanPaymentDoc>("loan_payments").findOne({ _id: objectId, loanId });
  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }
  if (payment.status !== "scheduled") {
    return NextResponse.json({ error: "Only scheduled payments can be deleted" }, { status: 409 });
  }

  await db.collection("loan_payments").deleteOne({ _id: objectId });

  return NextResponse.json({ ok: true });
}
