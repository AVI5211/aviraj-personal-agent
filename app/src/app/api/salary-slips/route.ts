import { NextRequest, NextResponse } from "next/server";
import { Binary } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { isSalarySpikeEnabled } from "@/lib/env";
import {
  MAX_SALARY_SLIP_BYTES,
  isValidMonth,
  looksLikePdf,
  serializeSalarySlip,
  type SalarySlipDoc,
} from "@/lib/salary-slips";

function disabled() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

function toPaise(value: FormDataEntryValue | null): number | null {
  const amount = Number(typeof value === "string" && value.trim() !== "" ? value : "0");
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null;
}

export async function GET() {
  if (!isSalarySpikeEnabled()) return disabled();
  const db = await getDb();
  const docs = await db
    .collection<SalarySlipDoc>("salary_slips")
    .find({}, { projection: { data: 0 } })
    .sort({ month: -1 })
    .toArray();
  return NextResponse.json({ salarySlips: docs.map(serializeSalarySlip) });
}

/** Uploads (or replaces) the PDF slip and its figures for one month. */
export async function POST(request: NextRequest) {
  if (!isSalarySpikeEnabled()) return disabled();

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Expected a multipart form upload" }, { status: 400 });

  const month = String(form.get("month") ?? "");
  if (!isValidMonth(month)) return NextResponse.json({ error: "month must be YYYY-MM" }, { status: 400 });

  const grossPaise = toPaise(form.get("gross"));
  const deductionsPaise = toPaise(form.get("deductions"));
  if (grossPaise === null || deductionsPaise === null) {
    return NextResponse.json({ error: "Amounts must be non-negative numbers" }, { status: 400 });
  }
  if (deductionsPaise > grossPaise) {
    return NextResponse.json({ error: "Deductions cannot exceed total earnings" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Attach a PDF file" }, { status: 400 });
  if (file.size > MAX_SALARY_SLIP_BYTES) {
    return NextResponse.json({ error: "PDF must be 5 MB or smaller" }, { status: 400 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!looksLikePdf(bytes)) return NextResponse.json({ error: "File is not a PDF" }, { status: 400 });

  const now = new Date();
  const db = await getDb();
  const result = await db.collection<SalarySlipDoc>("salary_slips").findOneAndUpdate(
    { month },
    {
      $set: {
        grossPaise,
        deductionsPaise,
        fileName: file.name.slice(0, 200),
        sizeBytes: bytes.length,
        data: new Binary(bytes),
        updatedAt: now,
      },
      $setOnInsert: { month, createdAt: now },
    },
    { upsert: true, returnDocument: "after", projection: { data: 0 } }
  );

  return NextResponse.json(serializeSalarySlip(result!), { status: 201 });
}
