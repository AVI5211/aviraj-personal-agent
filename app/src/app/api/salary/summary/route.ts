import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ensureSeeded } from "@/lib/seed";
import { computeSalaryOverview, type SalaryRecordDoc } from "@/lib/salary";

export async function GET(request: NextRequest) {
  await ensureSeeded();

  const year = request.nextUrl.searchParams.get("year");
  const filter = year && /^\d{4}$/.test(year) ? { month: { $regex: `^${year}-` } } : {};

  const db = await getDb();
  const records = await db.collection<SalaryRecordDoc>("salary_records").find(filter).toArray();

  return NextResponse.json(computeSalaryOverview(records));
}
