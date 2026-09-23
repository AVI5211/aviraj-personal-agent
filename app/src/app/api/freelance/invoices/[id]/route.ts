import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { updateInvoiceSchema } from "@/lib/validation";
import { serializeInvoice, type InvoiceDoc } from "@/lib/freelance";
import { parseObjectId } from "@/lib/transactions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const objectId = parseObjectId(id);
  if (!objectId) {
    return NextResponse.json({ error: "Invalid invoice id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = await getDb();
  const existing = await db.collection<InvoiceDoc>("invoices").findOne({ _id: objectId });
  if (!existing) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }
  if (existing.status === "paid") {
    return NextResponse.json({ error: "Invoice is already marked paid" }, { status: 409 });
  }

  const result = await db.collection<InvoiceDoc>("invoices").findOneAndUpdate(
    { _id: objectId },
    {
      $set: {
        status: "paid",
        netInrPaise: parsed.data.netInrPaise,
        taxPaidPaise: parsed.data.taxPaidPaise,
        paidDate: parsed.data.paidDate,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  );

  if (!result) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  return NextResponse.json(serializeInvoice(result));
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const objectId = parseObjectId(id);
  if (!objectId) {
    return NextResponse.json({ error: "Invalid invoice id" }, { status: 400 });
  }

  const db = await getDb();
  const existing = await db.collection<InvoiceDoc>("invoices").findOne({ _id: objectId });
  if (!existing) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }
  if (existing.status === "paid") {
    return NextResponse.json({ error: "Cannot delete a paid invoice" }, { status: 409 });
  }

  // Un-invoice the linked work logs before removing the invoice so the
  // work never disappears from the unbilled pool.
  await db.collection("work_logs").updateMany(
    { _id: { $in: existing.workLogIds } },
    { $set: { invoiced: false, invoiceId: null, updatedAt: new Date() } }
  );

  await db.collection("invoices").deleteOne({ _id: objectId });

  return NextResponse.json({ ok: true });
}
