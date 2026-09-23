import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { computeInvestmentSummary, type InvestmentDoc } from "@/lib/investments";

export async function GET() {
  const db = await getDb();
  const docs = await db.collection<InvestmentDoc>("investments").find({}).toArray();
  const summary = computeInvestmentSummary(docs);
  return NextResponse.json(summary);
}
