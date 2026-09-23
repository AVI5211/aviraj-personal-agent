import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ensureSeeded } from "@/lib/seed";
import { createTransactionSchema, listTransactionsQuerySchema } from "@/lib/validation";
import {
  buildDateRangeFilter,
  serializeTransaction,
  type TransactionDoc,
} from "@/lib/transactions";

export async function GET(request: NextRequest) {
  await ensureSeeded();

  const query = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = listTransactionsQuerySchema.safeParse(query);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { from, to, type, category, paymentMethod, page, pageSize } = parsed.data;

  const filter: Record<string, unknown> = {
    ...buildDateRangeFilter(from, to),
    ...(type ? { type } : {}),
    ...(category ? { category } : {}),
    ...(paymentMethod ? { paymentMethod } : {}),
  };

  const db = await getDb();
  const collection = db.collection<TransactionDoc>("transactions");

  const [docs, total] = await Promise.all([
    collection
      .find(filter)
      .sort({ transactionDate: -1, createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray(),
    collection.countDocuments(filter),
  ]);

  return NextResponse.json({
    transactions: docs.map(serializeTransaction),
    total,
    page,
    pageSize,
  });
}

export async function POST(request: NextRequest) {
  await ensureSeeded();

  const body = await request.json().catch(() => null);
  const parsed = createTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const now = new Date();
  const doc = {
    type: data.type,
    amountPaise: data.amountPaise,
    category: data.category,
    paymentMethod: data.paymentMethod,
    source: "manual" as const,
    transactionDate: data.transactionDate,
    description: data.description,
    createdAt: now,
    updatedAt: now,
  };

  const db = await getDb();
  const result = await db.collection("transactions").insertOne(doc);

  return NextResponse.json(
    serializeTransaction({ _id: result.insertedId, ...doc }),
    { status: 201 }
  );
}
