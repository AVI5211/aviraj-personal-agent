import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { createInvoiceSchema, listInvoicesQuerySchema } from "@/lib/validation";
import {
  computeGrossAmountMinor,
  computeNetInrPaise,
  serializeInvoice,
  type ClientDoc,
  type InvoiceDoc,
  type WorkLogDoc,
} from "@/lib/freelance";
import { parseObjectId } from "@/lib/transactions";
import { todayInShopTz } from "@/lib/dates";

export async function GET(request: NextRequest) {
  const query = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = listInvoicesQuerySchema.safeParse(query);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { clientId, status } = parsed.data;
  const filter: Record<string, unknown> = {};
  if (clientId) {
    const objectId = parseObjectId(clientId);
    if (!objectId) {
      return NextResponse.json({ error: "Invalid clientId" }, { status: 400 });
    }
    filter.clientId = objectId;
  }
  if (status) filter.status = status;

  const db = await getDb();
  const docs = await db
    .collection<InvoiceDoc>("invoices")
    .find(filter)
    .sort({ issueDate: -1, createdAt: -1 })
    .toArray();

  return NextResponse.json({ invoices: docs.map(serializeInvoice) });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = createInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const clientId = parseObjectId(data.clientId);
  if (!clientId) {
    return NextResponse.json({ error: "Invalid clientId" }, { status: 400 });
  }

  const workLogObjectIds: ObjectId[] = [];
  for (const rawId of data.workLogIds) {
    const objectId = parseObjectId(rawId);
    if (!objectId) {
      return NextResponse.json({ error: `Invalid workLogId: ${rawId}` }, { status: 400 });
    }
    workLogObjectIds.push(objectId);
  }

  const db = await getDb();

  const client = await db.collection<ClientDoc>("clients").findOne({ _id: clientId });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const workLogs = await db
    .collection<WorkLogDoc>("work_logs")
    .find({ _id: { $in: workLogObjectIds } })
    .toArray();

  if (workLogs.length !== workLogObjectIds.length) {
    return NextResponse.json({ error: "One or more work logs were not found" }, { status: 404 });
  }
  if (workLogs.some((log) => log.invoiced)) {
    return NextResponse.json({ error: "One or more work logs are already invoiced" }, { status: 409 });
  }
  if (workLogs.some((log) => log.clientId.toString() !== clientId.toString())) {
    return NextResponse.json({ error: "All work logs must belong to the same client" }, { status: 400 });
  }

  const hours = workLogs.reduce((sum, log) => sum + log.billableHours, 0);
  const grossAmountMinor = computeGrossAmountMinor(workLogs, client.hourlyRateMinor);
  const netInrPaise = computeNetInrPaise(grossAmountMinor, data.feesMinor, data.exchangeRateToInr);

  const now = new Date();
  const invoiceDoc = {
    clientId,
    issueDate: todayInShopTz(now),
    workLogIds: workLogObjectIds,
    hours,
    currency: client.currency,
    paymentPlatform: data.paymentPlatform,
    grossAmountMinor,
    feesMinor: data.feesMinor,
    exchangeRateToInr: data.exchangeRateToInr,
    netInrPaise,
    taxPaidPaise: 0,
    status: "issued" as const,
    paidDate: null,
    createdAt: now,
    updatedAt: now,
  };

  // Insert the invoice first, then mark the work logs invoiced. If the second
  // step fails, we still have the invoice — but no work logs would be
  // double-counted (they'd just be manually reconciled), which fails safer
  // than marking logs invoiced before an invoice exists.
  const result = await db.collection("invoices").insertOne(invoiceDoc);

  await db.collection("work_logs").updateMany(
    { _id: { $in: workLogObjectIds } },
    { $set: { invoiced: true, invoiceId: result.insertedId, updatedAt: now } }
  );

  return NextResponse.json(serializeInvoice({ _id: result.insertedId, ...invoiceDoc }), { status: 201 });
}
