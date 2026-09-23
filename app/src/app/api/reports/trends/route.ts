import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ensureSeeded } from "@/lib/seed";
import { trendsQuerySchema } from "@/lib/validation";
import { monthsBack } from "@/lib/dates";

interface MonthGroupResult {
  _id: { month: string; type: "income" | "expense"; category: string };
  total: number;
}

export async function GET(request: NextRequest) {
  await ensureSeeded();

  const query = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = trendsQuerySchema.safeParse(query);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const monthLabels = monthsBack(parsed.data.months);
  const earliestMonth = monthLabels[0];
  const fromDate = `${earliestMonth}-01`;

  const db = await getDb();
  const rows = await db
    .collection("transactions")
    .aggregate<MonthGroupResult>([
      { $match: { module: parsed.data.module, transactionDate: { $gte: fromDate } } },
      {
        $group: {
          _id: { month: { $substrBytes: ["$transactionDate", 0, 7] }, type: "$type", category: "$category" },
          total: { $sum: "$amountPaise" },
        },
      },
    ])
    .toArray();

  const totalsByMonth = new Map<string, { income: number; expense: number; moneyLent: number }>();
  for (const label of monthLabels) {
    totalsByMonth.set(label, { income: 0, expense: 0, moneyLent: 0 });
  }
  for (const row of rows) {
    const entry = totalsByMonth.get(row._id.month);
    if (!entry) continue;
    if (parsed.data.module === "personal" && ["money_lent", "security_deposit"].includes(row._id.category)) entry.moneyLent += row.total;
    else if (row._id.category !== "money_return") entry[row._id.type] = row.total;
  }

  const trends = monthLabels.map((month) => ({
    month,
    income: totalsByMonth.get(month)!.income,
    expense: totalsByMonth.get(month)!.expense,
    moneyLent: totalsByMonth.get(month)!.moneyLent,
  }));

  return NextResponse.json({ trends });
}
