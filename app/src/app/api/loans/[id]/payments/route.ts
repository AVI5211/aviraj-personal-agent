import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { createLoanPaymentSchema } from "@/lib/validation";
import { serializeLoanPayment, type LoanDoc } from "@/lib/loans";
import { parseObjectId } from "@/lib/transactions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

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

  const body = await request.json().catch(() => null);
  const parsed = createLoanPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const now = new Date();
  const data = parsed.data;
  const doc = {
    loanId: objectId,
    dueDate: data.dueDate,
    amountPaise: data.amountPaise ?? loan.monthlyEmiPaise,
    principalPaise: data.principalPaise ?? null,
    interestPaise: data.interestPaise ?? null,
    feesPaise: data.feesPaise ?? null,
    status: "scheduled" as const,
    paidDate: null,
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.collection("loan_payments").insertOne(doc);

  return NextResponse.json(serializeLoanPayment({ _id: result.insertedId, ...doc }), { status: 201 });
}
