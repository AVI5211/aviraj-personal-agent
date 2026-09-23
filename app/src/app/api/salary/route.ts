import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ensureSeeded } from "@/lib/seed";
import { createSalaryRecordSchema } from "@/lib/validation";
import { serializeSalaryRecord, type SalaryRecordDoc } from "@/lib/salary";

export async function GET() {
  await ensureSeeded();
  const db = await getDb();
  const docs = await db
    .collection<SalaryRecordDoc>("salary_records")
    .find({})
    .sort({ month: -1 })
    .limit(24)
    .toArray();
  return NextResponse.json({ salaryRecords: docs.map(serializeSalaryRecord) });
}

export async function POST(request: NextRequest) {
  await ensureSeeded();

  const body = await request.json().catch(() => null);
  const parsed = createSalaryRecordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const now = new Date();
  const doc = {
    month: parsed.data.month,
    grossPaise: parsed.data.grossPaise,
    deductionsPaise: parsed.data.deductionsPaise,
    pfEmployeePaise: parsed.data.pfEmployeePaise,
    pfEmployerPaise: parsed.data.pfEmployerPaise,
    tdsPaise: parsed.data.tdsPaise,
    recurringPf: parsed.data.recurringPf,
    recurringTds: parsed.data.recurringTds,
    status: parsed.data.status,
    receivedDate: parsed.data.receivedDate ?? null,
    note: parsed.data.note,
    createdAt: now,
    updatedAt: now,
  };

  const db = await getDb();
  try {
    const result = await db.collection("salary_records").insertOne(doc);
    return NextResponse.json(serializeSalaryRecord({ _id: result.insertedId, ...doc }), { status: 201 });
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as { code?: number }).code === 11000) {
      return NextResponse.json({ error: `A salary record for ${doc.month} already exists` }, { status: 409 });
    }
    throw err;
  }
}
