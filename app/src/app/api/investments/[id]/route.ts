import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { updateInvestmentSchema } from "@/lib/validation";
import {
  serializeInvestment,
  serializeInvestmentValuation,
  type InvestmentDoc,
  type InvestmentValuationDoc,
} from "@/lib/investments";
import { parseObjectId } from "@/lib/transactions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const objectId = parseObjectId(id);
  if (!objectId) {
    return NextResponse.json({ error: "Invalid investment id" }, { status: 400 });
  }

  const db = await getDb();
  const doc = await db.collection<InvestmentDoc>("investments").findOne({ _id: objectId });
  if (!doc) {
    return NextResponse.json({ error: "Investment not found" }, { status: 404 });
  }

  const valuations = await db
    .collection<InvestmentValuationDoc>("investment_valuations")
    .find({ investmentId: objectId })
    .sort({ valuationDate: 1 })
    .toArray();

  return NextResponse.json({
    investment: serializeInvestment(doc),
    valuations: valuations.map(serializeInvestmentValuation),
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const objectId = parseObjectId(id);
  if (!objectId) {
    return NextResponse.json({ error: "Invalid investment id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateInvestmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = await getDb();
  const existing = await db.collection<InvestmentDoc>("investments").findOne({ _id: objectId });
  if (!existing) {
    return NextResponse.json({ error: "Investment not found" }, { status: 404 });
  }

  const now = new Date();
  const result = await db.collection<InvestmentDoc>("investments").findOneAndUpdate(
    { _id: objectId },
    { $set: { ...parsed.data, updatedAt: now } },
    { returnDocument: "after" }
  );

  if (!result) {
    return NextResponse.json({ error: "Investment not found" }, { status: 404 });
  }

  const valuationChanged =
    (parsed.data.currentValuePaise !== undefined && parsed.data.currentValuePaise !== existing.currentValuePaise) ||
    (parsed.data.valuationDate !== undefined && parsed.data.valuationDate !== existing.valuationDate);

  if (valuationChanged) {
    const valuationDoc: Omit<InvestmentValuationDoc, "_id"> = {
      investmentId: objectId,
      valuationDate: result.valuationDate,
      valuePaise: result.currentValuePaise,
      createdAt: now,
    };
    await db.collection("investment_valuations").insertOne(valuationDoc);
  }

  return NextResponse.json(serializeInvestment(result));
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const objectId = parseObjectId(id);
  if (!objectId) {
    return NextResponse.json({ error: "Invalid investment id" }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.collection("investments").deleteOne({ _id: objectId });

  if (result.deletedCount === 0) {
    return NextResponse.json({ error: "Investment not found" }, { status: 404 });
  }

  await db.collection("investment_valuations").deleteMany({ investmentId: objectId });

  return NextResponse.json({ ok: true });
}
