import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { updateTransactionSchema } from "@/lib/validation";
import { parseObjectId, serializeTransaction, type TransactionDoc } from "@/lib/transactions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const objectId = parseObjectId(id);
  if (!objectId) {
    return NextResponse.json({ error: "Invalid transaction id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = await getDb();
  const collection = db.collection<TransactionDoc>("transactions");

  const result = await collection.findOneAndUpdate(
    { _id: objectId },
    { $set: { ...parsed.data, updatedAt: new Date() } },
    { returnDocument: "after" }
  );

  if (!result) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  return NextResponse.json(serializeTransaction(result));
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const objectId = parseObjectId(id);
  if (!objectId) {
    return NextResponse.json({ error: "Invalid transaction id" }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.collection<TransactionDoc>("transactions").deleteOne({ _id: objectId });

  if (result.deletedCount === 0) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
