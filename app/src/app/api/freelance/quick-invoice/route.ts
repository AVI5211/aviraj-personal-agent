import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { createQuickInvoiceSchema } from "@/lib/validation";
import {
  allocateHoursFifo,
  computeGrossAmountMinor,
  computeNetInrPaise,
  serializeInvoice,
  type ClientDoc,
  type WorkLogDoc,
} from "@/lib/freelance";
import { parseObjectId } from "@/lib/transactions";
import { todayInShopTz } from "@/lib/dates";
import { setFreelanceUsdInrRate } from "@/lib/settings";

/**
 * Invoice a flat number of hours for a client without caring which specific
 * work-log entries or epics they come from. Consumes the oldest unbilled
 * work first; if the hour target lands in the middle of an entry, that entry
 * is split into a paid portion and a leftover portion that stays unbilled
 * (visibly "partially billed" via its notes) rather than ever going negative.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = createQuickInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const clientId = parseObjectId(data.clientId);
  if (!clientId) {
    return NextResponse.json({ error: "Invalid clientId" }, { status: 400 });
  }

  const db = await getDb();
  const client = await db.collection<ClientDoc>("clients").findOne({ _id: clientId });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const unbilledLogs = await db
    .collection<WorkLogDoc>("work_logs")
    .find({ clientId, invoiced: false })
    .sort({ date: 1, createdAt: 1 })
    .toArray();

  if (unbilledLogs.length === 0) {
    return NextResponse.json({ error: "No unbilled work for this client" }, { status: 400 });
  }

  const now = new Date();
  const today = todayInShopTz(now);

  const allocation = allocateHoursFifo(
    unbilledLogs.map((log) => ({ id: log._id.toString(), billableHours: log.billableHours })),
    data.hours
  );

  const workLogIds: ObjectId[] = allocation.fullyConsumedIds.map((id) => new ObjectId(id));

  if (allocation.partialSplit) {
    const { id, paidHours, leftoverHours } = allocation.partialSplit;
    const original = unbilledLogs.find((log) => log._id.toString() === id)!;

    const paidDoc = {
      clientId: original.clientId,
      epicId: original.epicId,
      date: original.date,
      billableHours: paidHours,
      nonBillableHours: 0,
      description: original.description,
      notes: original.notes,
      invoiced: false,
      invoiceId: null,
      createdAt: now,
      updatedAt: now,
    };
    const insertResult = await db.collection("work_logs").insertOne(paidDoc);
    workLogIds.push(insertResult.insertedId);

    await db.collection("work_logs").updateOne(
      { _id: original._id },
      {
        $set: {
          billableHours: leftoverHours,
          notes: `[Partially billed ${paidHours}h on ${today}] ${original.notes}`.trim(),
          updatedAt: now,
        },
      }
    );
  }

  const includedLogs = await db
    .collection<WorkLogDoc>("work_logs")
    .find({ _id: { $in: workLogIds } })
    .toArray();

  const hours = includedLogs.reduce((sum, log) => sum + log.billableHours, 0);
  const grossAmountMinor = computeGrossAmountMinor(includedLogs, client.hourlyRateMinor);
  const netInrPaise = computeNetInrPaise(grossAmountMinor, data.feesMinor, data.exchangeRateToInr);
  const taxPaidPaise = Math.round(netInrPaise * (data.taxPercent / 100));

  const invoiceDoc = {
    clientId,
    issueDate: today,
    workLogIds,
    hours,
    currency: client.currency,
    paymentPlatform: data.paymentPlatform,
    grossAmountMinor,
    feesMinor: data.feesMinor,
    exchangeRateToInr: data.exchangeRateToInr,
    netInrPaise,
    taxPaidPaise,
    status: "paid" as const,
    paidDate: today,
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.collection("invoices").insertOne(invoiceDoc);

  if (client.currency === "USD") {
    await setFreelanceUsdInrRate(data.exchangeRateToInr);
  }

  await db
    .collection("work_logs")
    .updateMany({ _id: { $in: workLogIds } }, { $set: { invoiced: true, invoiceId: result.insertedId, updatedAt: now } });

  return NextResponse.json(
    {
      invoice: serializeInvoice({ _id: result.insertedId, ...invoiceDoc }),
      requestedHours: data.hours,
      invoicedHours: allocation.invoicedHours,
      capped: allocation.invoicedHours < data.hours,
    },
    { status: 201 }
  );
}
