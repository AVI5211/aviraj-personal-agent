import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { returnReceivableSchema } from "@/lib/validation";
import { parseObjectId } from "@/lib/transactions";
import { serializeReceivable, type ReceivableDoc } from "@/lib/receivables";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = parseObjectId((await params).id); if (!id) return NextResponse.json({ error: "Invalid receivable id" }, { status: 400 });
  const parsed = returnReceivableSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const db = await getDb(); const existing = await db.collection<ReceivableDoc>("receivables").findOne({ _id: id, status: "pending" });
  if (!existing) return NextResponse.json({ error: "Pending receivable not found" }, { status: 404 });
  const now = new Date(); const data = parsed.data;
  await db.collection<ReceivableDoc>("receivables").updateOne({ _id: id }, { $set: { status: "returned", returnedDate: data.returnedDate, updatedAt: now } });
  await db.collection("transactions").insertOne({ module: "personal", type: "income", amountPaise: existing.amountPaise, category: "money_return", paymentMethod: data.paymentMethod, source: "receivable", transactionDate: data.returnedDate, description: `Money returned by ${existing.personName}`, createdAt: now, updatedAt: now });
  return NextResponse.json(serializeReceivable({ ...existing, status: "returned", returnedDate: data.returnedDate, updatedAt: now }));
}
