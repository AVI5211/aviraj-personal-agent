import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { isSalarySpikeEnabled } from "@/lib/env";
import { isValidMonth, type SalarySlipDoc } from "@/lib/salary-slips";

interface RouteParams {
  params: Promise<{ month: string }>;
}

// Note: this path deliberately has no ".pdf" suffix — middleware lets any path ending
// in a file extension through without a session, which would expose the slips.

/** Streams the stored PDF inline so the app can show it in its viewer. */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  if (!isSalarySpikeEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { month } = await params;
  if (!isValidMonth(month)) return NextResponse.json({ error: "Invalid month" }, { status: 400 });

  const db = await getDb();
  const doc = await db.collection<SalarySlipDoc>("salary_slips").findOne({ month });
  if (!doc) return NextResponse.json({ error: "No slip for this month" }, { status: 404 });

  return new NextResponse(new Uint8Array(doc.data.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="salary-slip-${month}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  if (!isSalarySpikeEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { month } = await params;
  if (!isValidMonth(month)) return NextResponse.json({ error: "Invalid month" }, { status: 400 });

  const db = await getDb();
  const result = await db.collection("salary_slips").deleteOne({ month });
  if (result.deletedCount === 0) return NextResponse.json({ error: "No slip for this month" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
