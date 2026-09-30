import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/mongodb";
import { isValidDateString, todayInShopTz } from "@/lib/dates";
import { buildEarningsChart, chartRange } from "@/lib/earnings-chart";
import type { SalaryRecordDoc } from "@/lib/salary";
import type { ClientDoc, WorkLogDoc } from "@/lib/freelance";
import type { TransactionDoc } from "@/lib/transactions";
import { getFreelanceUsdInrRate } from "@/lib/settings";

const periodSchema = z.enum(["today", "yesterday", "week", "last7", "month", "lastMonth", "year", "fy", "custom", "all"]);

export async function GET(request: NextRequest) {
  const parsed = periodSchema.safeParse(request.nextUrl.searchParams.get("period") ?? "month");
  if (!parsed.success) return NextResponse.json({ error: "Invalid chart period" }, { status: 400 });

  const today = todayInShopTz();
  const db = await getDb();
  const custom = {
    from: request.nextUrl.searchParams.get("from") ?? "",
    to: request.nextUrl.searchParams.get("to") ?? "",
  };
  if (parsed.data === "custom" && (!isValidDateString(custom.from) || !isValidDateString(custom.to) || custom.from > custom.to)) {
    return NextResponse.json({ error: "Choose a valid date range" }, { status: 400 });
  }
  const allFirst = parsed.data === "all" ? await Promise.all([
    db.collection<TransactionDoc>("transactions").find({}).sort({ transactionDate: 1 }).limit(1).toArray(),
    db.collection<SalaryRecordDoc>("salary_records").find({ status: "received" }).sort({ month: 1 }).limit(1).toArray(),
    db.collection<WorkLogDoc>("work_logs").find({}).sort({ date: 1 }).limit(1).toArray(),
  ]) : null;
  const allFrom = allFirst ? [allFirst[0][0]?.transactionDate, allFirst[1][0]?.month && `${allFirst[1][0].month}-01`, allFirst[2][0]?.date]
    .filter((date): date is string => Boolean(date)).sort()[0] : undefined;
  const range = chartRange(parsed.data, today, custom, allFrom);
  // The monthly chart displays all calendar days, but only entries logged
  // through today count in the Overview's current-month total.
  const dataTo = parsed.data === "month" ? today : range.to;
  const [transactions, salaries, workLogs, clients, usdInrRate] = await Promise.all([
    db.collection<TransactionDoc>("transactions")
      .find({ transactionDate: { $gte: range.from, $lte: dataTo }, type: "income" }).toArray(),
    db.collection<SalaryRecordDoc>("salary_records")
      .find({ month: { $gte: range.from.slice(0, 7), $lte: range.to.slice(0, 7) }, status: "received" }).toArray(),
    db.collection<WorkLogDoc>("work_logs").find({ date: { $gte: range.from, $lte: dataTo } }).toArray(),
    db.collection<ClientDoc>("clients").find({}).toArray(),
    getFreelanceUsdInrRate(),
  ]);
  const points = buildEarningsChart(parsed.data, today, transactions, salaries, workLogs, clients, usdInrRate, custom, allFrom);
  return NextResponse.json({ period: parsed.data, range, points });
}
