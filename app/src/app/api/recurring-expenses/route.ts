import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { createRecurringExpenseSchema } from "@/lib/validation";
import { serializeRecurringExpense, type RecurringExpenseDoc } from "@/lib/recurring-expenses";

export async function GET() {
  const db = await getDb();
  const expenses = await db
    .collection<RecurringExpenseDoc>("recurring_expenses")
    .find({})
    .sort({ dueDayOfMonth: 1, name: 1 })
    .toArray();

  return NextResponse.json({ recurringExpenses: expenses.map(serializeRecurringExpense) });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = createRecurringExpenseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const now = new Date();
  const doc = { ...parsed.data, createdAt: now, updatedAt: now };
  const db = await getDb();
  const result = await db.collection("recurring_expenses").insertOne(doc);

  return NextResponse.json(serializeRecurringExpense({ _id: result.insertedId, ...doc }), { status: 201 });
}
