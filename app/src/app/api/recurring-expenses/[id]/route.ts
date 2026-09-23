import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { type RecurringExpenseDoc } from "@/lib/recurring-expenses";
import { parseObjectId } from "@/lib/transactions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const objectId = parseObjectId(id);
  if (!objectId) {
    return NextResponse.json({ error: "Invalid recurring expense id" }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.collection<RecurringExpenseDoc>("recurring_expenses").deleteOne({ _id: objectId });
  if (result.deletedCount === 0) {
    return NextResponse.json({ error: "Recurring expense not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
