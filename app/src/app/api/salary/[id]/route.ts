import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { updateSalaryRecordSchema } from "@/lib/validation";
import { serializeSalaryRecord, type SalaryRecordDoc } from "@/lib/salary";
import { parseObjectId } from "@/lib/transactions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const objectId = parseObjectId(id);
  if (!objectId) {
    return NextResponse.json({ error: "Invalid salary record id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSalaryRecordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.collection<SalaryRecordDoc>("salary_records").findOneAndUpdate(
    { _id: objectId },
    { $set: { ...parsed.data, updatedAt: new Date() } },
    { returnDocument: "after" }
  );

  if (!result) {
    return NextResponse.json({ error: "Salary record not found" }, { status: 404 });
  }

  return NextResponse.json(serializeSalaryRecord(result));
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const objectId = parseObjectId(id);
  if (!objectId) {
    return NextResponse.json({ error: "Invalid salary record id" }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.collection<SalaryRecordDoc>("salary_records").deleteOne({ _id: objectId });

  if (result.deletedCount === 0) {
    return NextResponse.json({ error: "Salary record not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
