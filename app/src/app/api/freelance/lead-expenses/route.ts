import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { createLeadExpenseSchema } from "@/lib/validation";
import { serializeLeadExpense, type LeadExpenseDoc } from "@/lib/freelance";

function buildLeadExpenseDateFilter(from?: string | null, to?: string | null): Record<string, unknown> {
  if (!from && !to) return {};
  const range: Record<string, string> = {};
  if (from) range.$gte = from;
  if (to) range.$lte = to;
  return { date: range };
}

export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  const filter = buildLeadExpenseDateFilter(from, to);

  const db = await getDb();
  const docs = await db
    .collection<LeadExpenseDoc>("lead_expenses")
    .find(filter)
    .sort({ date: -1, createdAt: -1 })
    .toArray();

  return NextResponse.json({ leadExpenses: docs.map(serializeLeadExpense) });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = createLeadExpenseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const now = new Date();
  const doc = {
    date: data.date,
    amountPaise: data.amountPaise,
    category: data.category,
    description: data.description,
    createdAt: now,
  };

  const db = await getDb();
  const result = await db.collection("lead_expenses").insertOne(doc);

  return NextResponse.json(serializeLeadExpense({ _id: result.insertedId, ...doc }), { status: 201 });
}
