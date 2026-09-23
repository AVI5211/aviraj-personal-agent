import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { createEpicSchema } from "@/lib/validation";
import { serializeEpic, type EpicDoc } from "@/lib/freelance";
import { parseObjectId } from "@/lib/transactions";

export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get("clientId");
  const filter: Record<string, unknown> = {};

  if (clientId) {
    const objectId = parseObjectId(clientId);
    if (!objectId) {
      return NextResponse.json({ error: "Invalid clientId" }, { status: 400 });
    }
    filter.clientId = objectId;
  }

  const db = await getDb();
  const docs = await db.collection<EpicDoc>("epics").find(filter).sort({ createdAt: -1 }).toArray();

  return NextResponse.json({ epics: docs.map(serializeEpic) });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = createEpicSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const clientId = parseObjectId(parsed.data.clientId);
  if (!clientId) {
    return NextResponse.json({ error: "Invalid clientId" }, { status: 400 });
  }

  const db = await getDb();
  const client = await db.collection("clients").findOne({ _id: clientId });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const doc = { clientId, name: parsed.data.name, createdAt: new Date() };
  const result = await db.collection("epics").insertOne(doc);

  return NextResponse.json(serializeEpic({ _id: result.insertedId, ...doc }), { status: 201 });
}
