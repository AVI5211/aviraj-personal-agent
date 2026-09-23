import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { createClientSchema } from "@/lib/validation";
import { serializeClient, type ClientDoc } from "@/lib/freelance";

export async function GET() {
  const db = await getDb();
  const docs = await db.collection<ClientDoc>("clients").find({}).sort({ name: 1 }).toArray();
  return NextResponse.json({ clients: docs.map(serializeClient) });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = createClientSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const now = new Date();
  const doc = {
    name: data.name,
    currency: data.currency,
    hourlyRateMinor: data.hourlyRateMinor,
    contractNote: data.contractNote,
    createdAt: now,
    updatedAt: now,
  };

  const db = await getDb();
  const result = await db.collection("clients").insertOne(doc);

  return NextResponse.json(serializeClient({ _id: result.insertedId, ...doc }), { status: 201 });
}
