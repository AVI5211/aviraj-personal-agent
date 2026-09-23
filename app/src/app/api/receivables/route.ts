import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { createReceivableSchema } from "@/lib/validation";
import { serializeReceivable, type ReceivableDoc } from "@/lib/receivables";

export async function GET() {
  const db = await getDb();
  const items = await db.collection<ReceivableDoc>("receivables").find({}).sort({ status: 1, givenDate: -1 }).toArray();
  return NextResponse.json({ receivables: items.map(serializeReceivable) });
}

export async function POST(request: NextRequest) {
  const parsed = createReceivableSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const now = new Date(); const data = parsed.data;
  const doc = { personName: data.personName, amountPaise: data.amountPaise, givenDate: data.givenDate, expectedReturnDate: data.expectedReturnDate, status: "pending" as const, returnedDate: null, createdAt: now, updatedAt: now };
  const db = await getDb(); const result = await db.collection("receivables").insertOne(doc);
  await db.collection("transactions").insertOne({ module: "personal", type: "expense", amountPaise: data.amountPaise, category: "money_lent", paymentMethod: data.paymentMethod, source: "receivable", transactionDate: data.givenDate, description: `Money lent to ${data.personName}`, createdAt: now, updatedAt: now });
  return NextResponse.json(serializeReceivable({ _id: result.insertedId, ...doc }), { status: 201 });
}
