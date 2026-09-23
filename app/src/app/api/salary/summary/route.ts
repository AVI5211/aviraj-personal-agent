import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ensureSeeded } from "@/lib/seed";
import { computeSalaryOverview, type SalaryRecordDoc } from "@/lib/salary";

export async function GET(request: NextRequest) {
  await ensureSeeded();

  const year = request.nextUrl.searchParams.get("year");
  const fy = request.nextUrl.searchParams.get("fy");

  let filter: Record<string, unknown> = {};
  if (fy && /^\d{4}$/.test(fy)) {
    // Indian financial year: 1 April (fy) to 31 March (fy + 1).
    const fyStart = Number(fy);
    filter = { month: { $gte: `${fyStart}-04`, $lte: `${fyStart + 1}-03` } };
  } else if (year && /^\d{4}$/.test(year)) {
    filter = { month: { $regex: `^${year}-` } };
  }

  const db = await getDb();
  const records = await db.collection<SalaryRecordDoc>("salary_records").find(filter).toArray();

  return NextResponse.json(computeSalaryOverview(records));
}
