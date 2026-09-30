import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "@/lib/mongodb";
import { getDefaultFreelanceClientId, setDefaultFreelanceClientId } from "@/lib/settings";

const preferenceSchema = z.object({ clientId: z.string().refine(ObjectId.isValid, "Invalid client ID") });

export async function GET() {
  return NextResponse.json({ clientId: await getDefaultFreelanceClientId() });
}

export async function PUT(request: NextRequest) {
  const parsed = preferenceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid client" }, { status: 400 });

  const db = await getDb();
  const client = await db.collection("clients").findOne({ _id: new ObjectId(parsed.data.clientId) }, { projection: { _id: 1 } });
  if (!client) return NextResponse.json({ error: "That client no longer exists" }, { status: 404 });

  await setDefaultFreelanceClientId(parsed.data.clientId);
  return NextResponse.json({ clientId: parsed.data.clientId });
}
