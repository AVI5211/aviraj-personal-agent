import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ensureSeeded } from "@/lib/seed";
import { periodQuerySchema, SHOP_DRAW_CATEGORY } from "@/lib/validation";
import { resolvePeriod } from "@/lib/dates";
import { buildDateRangeFilter, type TransactionDoc } from "@/lib/transactions";
import { isLiability, type AccountDoc } from "@/lib/accounts";
import type { SalaryRecordDoc } from "@/lib/salary";

interface TypeGroupResult {
  _id: { module: "shop" | "personal"; type: "income" | "expense"; category: string };
  total: number;
}

export async function GET(request: NextRequest) {
  await ensureSeeded();

  const query = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = periodQuerySchema.omit({ module: true }).safeParse(query);
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
  const rangeFilter = buildDateRangeFilter(range.from, range.to);

  const [byModuleTypeCategory, accounts, salaryRecords] = await Promise.all([
    db
      .collection<TransactionDoc>("transactions")
      .aggregate<TypeGroupResult>([
        { $match: rangeFilter },
        {
          $group: {
            _id: { module: "$module", type: "$type", category: "$category" },
            total: { $sum: "$amountPaise" },
          },
        },
      ])
      .toArray(),
    db.collection<AccountDoc>("accounts").find({}).toArray(),
    range.from && range.to
      ? db
          .collection<SalaryRecordDoc>("salary_records")
          .find({ month: { $gte: range.from.slice(0, 7), $lte: range.to.slice(0, 7) } })
          .toArray()
      : db.collection<SalaryRecordDoc>("salary_records").find({}).toArray(),
  ]);

  let shopIncome = 0;
  let shopExpense = 0;
  let personalExpense = 0;
  let personalOtherIncome = 0;
  let shopDrawIncome = 0;

  for (const row of byModuleTypeCategory) {
    if (row._id.module === "shop") {
      if (row._id.type === "income") shopIncome += row.total;
      else shopExpense += row.total;
    } else {
      if (row._id.type === "expense") {
        personalExpense += row.total;
      } else if (row._id.category === SHOP_DRAW_CATEGORY) {
        shopDrawIncome += row.total;
      } else {
        personalOtherIncome += row.total;
      }
    }
  }

  const salaryIncome = salaryRecords.reduce((sum, record) => sum + (record.grossPaise - record.deductionsPaise), 0);

  let cashAndBank = 0;
  let investmentsTotal = 0;
  let pfTotal = 0;
  let otherAssetsTotal = 0;
  let liabilitiesTotal = 0;

  for (const account of accounts) {
    if (isLiability(account.type)) {
      liabilitiesTotal += account.balancePaise;
      continue;
    }
    if (account.type === "bank" || account.type === "cash") cashAndBank += account.balancePaise;
    else if (account.type === "investment") investmentsTotal += account.balancePaise;
    else if (account.type === "pf") pfTotal += account.balancePaise;
    else otherAssetsTotal += account.balancePaise;
  }

  const netWorth = cashAndBank + investmentsTotal + pfTotal + otherAssetsTotal - liabilitiesTotal;

  return NextResponse.json({
    range,
    netWorth,
    cashAndBank,
    investmentsTotal,
    pfTotal,
    otherAssetsTotal,
    liabilitiesTotal,
    monthlyIncome: salaryIncome + shopDrawIncome + personalOtherIncome,
    monthlyExpense: personalExpense,
    incomeSources: {
      salary: salaryIncome,
      shop: shopDrawIncome,
      freelance: 0,
    },
    shopNetCashFlow: shopIncome - shopExpense,
    receivables: 0,
  });
}
