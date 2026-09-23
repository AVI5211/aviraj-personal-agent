import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { createInvestmentSchema } from "@/lib/validation";
import { serializeInvestment, type InvestmentDoc, type InvestmentValuationDoc } from "@/lib/investments";

export async function GET() {
  const db = await getDb();
  const docs = await db
    .collection<InvestmentDoc>("investments")
    .find({})
    .sort({ holdingType: 1, name: 1 })
    .toArray();
  return NextResponse.json({ investments: docs.map(serializeInvestment) });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = createInvestmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const now = new Date();
  const doc = { ...parsed.data, createdAt: now, updatedAt: now };

  const db = await getDb();
  const result = await db.collection("investments").insertOne(doc);

  const valuationDoc: Omit<InvestmentValuationDoc, "_id"> = {
    investmentId: result.insertedId,
    valuationDate: parsed.data.valuationDate,
    valuePaise: parsed.data.currentValuePaise,
    createdAt: now,
  };
  await db.collection("investment_valuations").insertOne(valuationDoc);

  return NextResponse.json(serializeInvestment({ _id: result.insertedId, ...doc }), { status: 201 });
}
