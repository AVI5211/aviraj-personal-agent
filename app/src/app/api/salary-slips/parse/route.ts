import { NextRequest, NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
import { isSalarySpikeEnabled } from "@/lib/env";
import { MAX_SALARY_SLIP_BYTES, looksLikePdf } from "@/lib/salary-slips";
import { parseSalarySlipText, type ParsedSalarySlip } from "@/lib/salary-slip-parse";

const MAX_FILES_PER_BATCH = 24;

type ParseResult = { fileName: string } & ({ ok: true } & ParsedSalarySlip | { ok: false; error: string });

/**
 * Reads the month and totals out of one or more slip PDFs so the page can show a
 * preview before anything is saved. Nothing is written to the database here.
 */
export async function POST(request: NextRequest) {
  if (!isSalarySpikeEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const form = await request.formData().catch(() => null);
  const files = form?.getAll("files").filter((f): f is File => f instanceof File) ?? [];
  if (files.length === 0) return NextResponse.json({ error: "Attach at least one PDF" }, { status: 400 });
  if (files.length > MAX_FILES_PER_BATCH) {
    return NextResponse.json({ error: `Upload at most ${MAX_FILES_PER_BATCH} PDFs at a time` }, { status: 400 });
  }

  const results: ParseResult[] = [];
  for (const file of files) {
    const fileName = file.name.slice(0, 200);
    if (file.size > MAX_SALARY_SLIP_BYTES) {
      results.push({ fileName, ok: false, error: "PDF must be 5 MB or smaller" });
      continue;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!looksLikePdf(bytes)) {
      results.push({ fileName, ok: false, error: "File is not a PDF" });
      continue;
    }
    try {
      const pdf = await getDocumentProxy(bytes);
      const { text } = await extractText(pdf, { mergePages: true });
      results.push({ fileName, ok: true, ...parseSalarySlipText(text) });
    } catch {
      results.push({ fileName, ok: false, error: "Couldn't read text from this PDF" });
    }
  }

  return NextResponse.json({ results });
}
