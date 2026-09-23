import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { type LeadExpenseDoc } from "@/lib/freelance";
import { parseObjectId } from "@/lib/transactions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const objectId = parseObjectId(id);
  if (!objectId) {
    return NextResponse.json({ error: "Invalid lead expense id" }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.collection<LeadExpenseDoc>("lead_expenses").deleteOne({ _id: objectId });

  if (result.deletedCount === 0) {
    return NextResponse.json({ error: "Lead expense not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
