import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ensureSeeded } from "@/lib/seed";
import { periodQuerySchema, SHOP_DRAW_CATEGORY } from "@/lib/validation";
import { resolvePeriod, startOfYear, todayInShopTz } from "@/lib/dates";
import { buildDateRangeFilter, type TransactionDoc } from "@/lib/transactions";
import { isLiability, type AccountDoc } from "@/lib/accounts";
import { ctcPaiseFor, netPaiseFor, type SalaryRecordDoc } from "@/lib/salary";
import type { InvestmentDoc } from "@/lib/investments";
import type { LoanDoc } from "@/lib/loans";
import type { ClientDoc, InvoiceDoc, WorkLogDoc } from "@/lib/freelance";
import { getFreelanceUsdInrRate } from "@/lib/settings";

interface TypeGroupResult {
  _id: { module: "shop" | "personal"; type: "income" | "expense"; category: string };
  total: number;
}

function completedMonthsInPeriod(period: string, from: string | null): number {
  if (!from || (period !== "year" && period !== "fy")) return 1;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [todayYear, todayMonth] = today.split("-").map(Number);
  // Use fully completed months: Jan-August for a September YTD view.
  return Math.max(1, (todayYear - fromYear) * 12 + todayMonth - fromMonth);
}

function daysInMonth(month: string): number {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

function overlappingDays(from: string, to: string, month: string): number {
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
  const overlapStart = from > monthStart ? from : monthStart;
  const overlapEnd = to < monthEnd ? to : monthEnd;
  if (overlapStart > overlapEnd) return 0;

  const start = new Date(`${overlapStart}T00:00:00.000Z`);
  const end = new Date(`${overlapEnd}T00:00:00.000Z`);
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

function proratedSalaryPaise(record: SalaryRecordDoc, valuePaise: number, from: string | null, to: string | null): number {
  if (!from || !to) return valuePaise;
  return Math.round((valuePaise * overlappingDays(from, to, record.month)) / daysInMonth(record.month));
}

function workLogValuePaise(log: WorkLogDoc, client: ClientDoc | undefined, usdInrRate: number): number {
  if (!client) return 0;
  const amountMinor = log.billableHours * client.hourlyRateMinor;
  return client.currency === "INR" ? Math.round(amountMinor) : Math.round(amountMinor * usdInrRate);
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
  // This is deliberately independent from the overview filter: it is the
  // calendar-year, gross earning total shown next to net worth.
  const earnedToDate = todayInShopTz();
  const earnedFromDate = startOfYear(earnedToDate);
  const earnedRangeFilter = buildDateRangeFilter(earnedFromDate, earnedToDate);

  const [byModuleTypeCategory, earnedByModuleTypeCategory, accounts, salaryRecords, earnedSalaryRecords, investments, activeLoans, issuedInvoices, workLogsInRange, freelanceClients, earnedPaidInvoices, pendingPersonalReceivables, usdInrRate] =
    await Promise.all([
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
      db
        .collection<TransactionDoc>("transactions")
        .aggregate<TypeGroupResult>([
          { $match: earnedRangeFilter },
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
      db
        .collection<SalaryRecordDoc>("salary_records")
        .find({ month: { $gte: earnedFromDate.slice(0, 7), $lte: earnedToDate.slice(0, 7) } })
        .toArray(),
      db.collection<InvestmentDoc>("investments").find({}).toArray(),
      db.collection<LoanDoc>("loans").find({ status: "active" }).toArray(),
      db.collection<InvoiceDoc>("invoices").find({ status: "issued" }).toArray(),
      range.from && range.to
        ? db
            .collection<WorkLogDoc>("work_logs")
            .find({ date: { $gte: range.from, $lte: range.to } })
            .toArray()
        : db.collection<WorkLogDoc>("work_logs").find({}).toArray(),
      db.collection<ClientDoc>("clients").find({}).toArray(),
      db
        .collection<InvoiceDoc>("invoices")
        .find({ status: "paid", paidDate: { $gte: earnedFromDate, $lte: earnedToDate } })
        .toArray(),
      db.collection("receivables").aggregate([{ $match: { status: "pending" } }, { $group: { _id: null, total: { $sum: "$amountPaise" } } }]).toArray(),
      getFreelanceUsdInrRate(),
    ]);

  let shopIncome = 0;
  let shopExpense = 0;
  let personalExpense = 0;
  let personalOtherIncome = 0;
  let securityDepositsGiven = 0;

  for (const row of byModuleTypeCategory) {
    if (row._id.module === "shop") {
      if (row._id.type === "income") shopIncome += row.total;
      else shopExpense += row.total;
    } else {
      if (row._id.type === "expense") {
        if (["security_deposit", "money_lent"].includes(row._id.category)) {
          securityDepositsGiven += row.total;
        } else {
          personalExpense += row.total;
        }
      } else if (row._id.category === SHOP_DRAW_CATEGORY) {
        // Money already counted once as shop revenue above — skip it here so it
        // isn't double-counted as "other personal income" once it's drawn out.
        continue;
      } else {
        personalOtherIncome += row.total;
      }
    }
  }

  // Only records actually received count as income here — an "expected" future month
  // (e.g. a salary projection through the rest of the financial year) hasn't landed yet.
  // The headline figure is CTC (what was actually earned, before PF/TDS deductions), since
  // that's what shows up on Form 16 / ITR — in-hand is kept as a secondary reference only.
  const salaryCtc = salaryRecords
    .filter((record) => record.status === "received")
    .reduce((sum, record) => sum + proratedSalaryPaise(record, ctcPaiseFor(record), range.from, range.to), 0);
  const salaryInHand = salaryRecords
    .filter((record) => record.status === "received")
    .reduce((sum, record) => sum + proratedSalaryPaise(record, netPaiseFor(record), range.from, range.to), 0);
  const clientById = new Map(freelanceClients.map((client) => [client._id.toString(), client]));
  // Freelance income follows the day work was logged, valued at the saved USD-to-INR rate.
  const freelanceIncome = workLogsInRange.reduce(
    (sum, log) => sum + workLogValuePaise(log, clientById.get(log.clientId.toString()), usdInrRate),
    0
  );
  const receivables = issuedInvoices.reduce((sum, invoice) => sum + invoice.netInrPaise, 0);

  let earnedShopIncome = 0;
  let earnedPersonalIncome = 0;
  for (const row of earnedByModuleTypeCategory) {
    if (row._id.type !== "income") continue;
    if (row._id.module === "shop") {
      earnedShopIncome += row.total;
    } else if (row._id.category !== SHOP_DRAW_CATEGORY && row._id.category !== "money_return") {
      // A returned loan/deposit is the return of an asset, not fresh income.
      earnedPersonalIncome += row.total;
    }
  }
  const earnedSalaryCtc = earnedSalaryRecords
    .filter((record) => record.status === "received")
    .reduce((sum, record) => sum + ctcPaiseFor(record), 0);
  const earnedFreelanceGross = earnedPaidInvoices.reduce(
    (sum, invoice) => sum + Math.round(invoice.grossAmountMinor * invoice.exchangeRateToInr),
    0
  );
  const totalMoneyEarned = earnedSalaryCtc + earnedShopIncome + earnedPersonalIncome + earnedFreelanceGross;

  // Detailed investment holdings (the `investments` collection) supersede the coarse
  // `accounts` type:"investment" balance for net worth, so an account isn't double-counted
  // once its holdings have been migrated into the investments module.
  const investmentsTotal = investments.reduce((sum, inv) => sum + inv.currentValuePaise, 0);
  const loanOutstandingTotal = activeLoans.reduce((sum, loan) => sum + loan.outstandingPrincipalPaise, 0);

  let cashAndBank = 0;
  let pfTotal = 0;
  let otherAssetsTotal = 0;
  let liabilitiesTotal = loanOutstandingTotal;

  for (const account of accounts) {
    if (isLiability(account.type)) {
      liabilitiesTotal += account.balancePaise;
      continue;
    }
    if (account.type === "bank" || account.type === "cash") cashAndBank += account.balancePaise;
    else if (account.type === "investment") continue; // superseded by the investments collection, see above
    else if (account.type === "pf") pfTotal += account.balancePaise;
    else otherAssetsTotal += account.balancePaise;
  }

  const personalReceivables = pendingPersonalReceivables[0]?.total ?? 0;
  const netWorth = cashAndBank + investmentsTotal + pfTotal + otherAssetsTotal + personalReceivables - liabilitiesTotal;

  const totalIncome = salaryCtc + shopIncome + personalOtherIncome + freelanceIncome;
  const monthsForAverage = completedMonthsInPeriod(parsed.data.period, range.from);

  return NextResponse.json({
    range,
    netWorth,
    totalMoneyEarned,
    cashAndBank,
    investmentsTotal,
    pfTotal,
    otherAssetsTotal,
    liabilitiesTotal,
    monthlyIncome: totalIncome,
    monthlyExpense: personalExpense,
    averageMonthlyIncome: Math.round(totalIncome / monthsForAverage),
    averageMonthlyExpense: Math.round(personalExpense / monthsForAverage),
    incomeSources: {
      salary: salaryCtc,
      salaryInHand,
      shop: shopIncome,
      freelance: freelanceIncome,
      otherPersonal: personalOtherIncome,
      securityDepositsGiven,
    },
    shopNetCashFlow: shopIncome - shopExpense,
    receivables,
    personalReceivables,
  });
}
