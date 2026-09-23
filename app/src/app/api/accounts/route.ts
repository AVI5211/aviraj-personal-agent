import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ensureSeeded } from "@/lib/seed";
import { createAccountSchema } from "@/lib/validation";
import { serializeAccount, type AccountDoc } from "@/lib/accounts";

export async function GET() {
  await ensureSeeded();
  const db = await getDb();
  const docs = await db.collection<AccountDoc>("accounts").find({}).sort({ type: 1, name: 1 }).toArray();
  return NextResponse.json({ accounts: docs.map(serializeAccount) });
}

export async function POST(request: NextRequest) {
  await ensureSeeded();

  const body = await request.json().catch(() => null);
  const parsed = createAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const now = new Date();
  const doc = { ...parsed.data, createdAt: now, updatedAt: now };

  const db = await getDb();
  const result = await db.collection("accounts").insertOne(doc);

  return NextResponse.json(serializeAccount({ _id: result.insertedId, ...doc }), { status: 201 });
}
