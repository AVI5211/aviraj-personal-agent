import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { createWorkLogSchema, listWorkLogsQuerySchema } from "@/lib/validation";
import { serializeWorkLog, type WorkLogDoc } from "@/lib/freelance";
import { parseObjectId } from "@/lib/transactions";

export async function GET(request: NextRequest) {
  const query = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = listWorkLogsQuerySchema.safeParse(query);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { clientId, invoiced } = parsed.data;
  const filter: Record<string, unknown> = {};

  if (clientId) {
    const objectId = parseObjectId(clientId);
    if (!objectId) {
      return NextResponse.json({ error: "Invalid clientId" }, { status: 400 });
    }
    filter.clientId = objectId;
  }
  if (invoiced !== undefined) {
    filter.invoiced = invoiced;
  }

  const db = await getDb();
  const docs = await db
    .collection<WorkLogDoc>("work_logs")
    .find(filter)
    .sort({ date: -1, createdAt: -1 })
    .toArray();

  return NextResponse.json({ workLogs: docs.map(serializeWorkLog) });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = createWorkLogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const clientId = parseObjectId(data.clientId);
  if (!clientId) {
    return NextResponse.json({ error: "Invalid clientId" }, { status: 400 });
  }

  const db = await getDb();
  const client = await db.collection("clients").findOne({ _id: clientId });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  let epicId = null;
  if (data.epicId) {
    epicId = parseObjectId(data.epicId);
    if (!epicId) {
      return NextResponse.json({ error: "Invalid epicId" }, { status: 400 });
    }
    const epic = await db.collection("epics").findOne({ _id: epicId, clientId });
    if (!epic) {
      return NextResponse.json({ error: "Epic not found for this client" }, { status: 404 });
    }
  }

  const now = new Date();
  const doc = {
    clientId,
    epicId,
    date: data.date,
    billableHours: data.billableHours,
    nonBillableHours: data.nonBillableHours,
    description: data.description,
    notes: data.notes,
    invoiced: false,
    invoiceId: null,
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.collection("work_logs").insertOne(doc);

  return NextResponse.json(serializeWorkLog({ _id: result.insertedId, ...doc }), { status: 201 });
}
