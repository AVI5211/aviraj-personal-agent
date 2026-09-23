import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ensureSeeded } from "@/lib/seed";
import { periodQuerySchema, PAYMENT_METHODS } from "@/lib/validation";
import { resolvePeriod } from "@/lib/dates";
import { buildDateRangeFilter } from "@/lib/transactions";
import { computeBalances } from "@/lib/summary";
import { getOpeningBalancePaise } from "@/lib/settings";

interface MethodGroupResult {
  _id: { type: "income" | "expense"; paymentMethod: string };
  total: number;
}

interface CategoryGroupResult {
  _id: string;
  total: number;
}

interface TypeGroupResult {
  _id: "income" | "expense";
  total: number;
}
const ASSET_TRANSFER_CATEGORIES = ["security_deposit", "money_lent", "money_return"];

function emptyMethodTotals(): Record<string, number> {
  return Object.fromEntries(PAYMENT_METHODS.map((method) => [method, 0]));
}

export async function GET(request: NextRequest) {
  await ensureSeeded();

  const query = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = periodQuerySchema.safeParse(query);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  let range;
  try {
    range = resolvePeriod(parsed.data.period, { from: parsed.data.from, to: parsed.data.to });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  const db = await getDb();
  const transactions = db.collection("transactions");
  const moduleFilter = { module: parsed.data.module };
  const rangeFilter = { ...moduleFilter, ...buildDateRangeFilter(range.from, range.to) };

  const [byMethod, byCategory, baseOpeningBalance, priorTotals] = await Promise.all([
    transactions
      .aggregate<MethodGroupResult>([
        { $match: { ...rangeFilter, category: { $nin: ASSET_TRANSFER_CATEGORIES } } },
        { $group: { _id: { type: "$type", paymentMethod: "$paymentMethod" }, total: { $sum: "$amountPaise" } } },
      ])
      .toArray(),
    transactions
      .aggregate<CategoryGroupResult>([
        { $match: { ...rangeFilter, type: "expense", category: { $nin: ASSET_TRANSFER_CATEGORIES } } },
        { $group: { _id: "$category", total: { $sum: "$amountPaise" } } },
      ])
      .toArray(),
    parsed.data.module === "shop" ? getOpeningBalancePaise() : Promise.resolve(0),
    range.from
      ? transactions
          .aggregate<TypeGroupResult>([
            { $match: { ...moduleFilter, transactionDate: { $lt: range.from }, category: { $nin: ASSET_TRANSFER_CATEGORIES } } },
            { $group: { _id: "$type", total: { $sum: "$amountPaise" } } },
          ])
          .toArray()
      : Promise.resolve([] as TypeGroupResult[]),
  ]);

  let totalIncome = 0;
  let totalExpense = 0;
  const incomeByMethod = emptyMethodTotals();
  const expenseByMethod = emptyMethodTotals();

  for (const row of byMethod) {
    if (row._id.type === "income") {
      totalIncome += row.total;
      incomeByMethod[row._id.paymentMethod] = (incomeByMethod[row._id.paymentMethod] ?? 0) + row.total;
    } else {
      totalExpense += row.total;
      expenseByMethod[row._id.paymentMethod] = (expenseByMethod[row._id.paymentMethod] ?? 0) + row.total;
    }
  }

  const expenseByCategory: Record<string, number> = {};
  for (const row of byCategory) {
    expenseByCategory[row._id] = row.total;
  }

  let priorIncome = 0;
  let priorExpense = 0;
  for (const row of priorTotals) {
    if (row._id === "income") priorIncome = row.total;
    if (row._id === "expense") priorExpense = row.total;
  }

  const { openingBalance, netCashFlow, closingBalance } = computeBalances({
    baseOpeningBalance,
    priorIncome,
    priorExpense,
    totalIncome,
    totalExpense,
  });

  return NextResponse.json({
    range,
    totalIncome,
    totalExpense,
    netCashFlow,
    openingBalance,
    closingBalance,
    incomeByMethod,
    expenseByMethod,
    expenseByCategory,
  });
}
