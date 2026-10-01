import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ensureSeeded } from "@/lib/seed";
import { periodQuerySchema, SHOP_DRAW_CATEGORY } from "@/lib/validation";
import { resolvePeriod, startOfFinancialYear, startOfYear, todayInShopTz } from "@/lib/dates";
import { overviewIncomeAverage } from "@/lib/overview-income-average";
import { buildDateRangeFilter, type TransactionDoc } from "@/lib/transactions";
import { isLiability, type AccountDoc } from "@/lib/accounts";
import { ctcPaiseFor, earnedSalaryPaise, netPaiseFor, type SalaryRecordDoc } from "@/lib/salary";
import type { InvestmentDoc } from "@/lib/investments";
import type { LoanDoc } from "@/lib/loans";
import type { ClientDoc, InvoiceDoc, WorkLogDoc } from "@/lib/freelance";
import { getFreelanceUsdInrRate } from "@/lib/settings";

interface TypeGroupResult {
  _id: { module: "shop" | "personal"; type: "income" | "expense"; category: string };
  total: number;
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

  const [byModuleTypeCategory, earnedByModuleTypeCategory, accounts, salaryRecords, earnedSalaryRecords, investments, activeLoans, issuedInvoices, workLogsInRange, freelanceClients, earnedWorkLogs, pendingPersonalReceivables, usdInrRate] =
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
      db.collection<WorkLogDoc>("work_logs").find({ date: { $gte: earnedFromDate, $lte: earnedToDate } }).toArray(),
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
      } else if (row._id.category === SHOP_DRAW_CATEGORY || row._id.category === "money_return") {
        // Money already counted once as shop revenue above — skip it here so it
        // isn't double-counted as "other personal income" once it's drawn out.
        continue;
      } else {
        personalOtherIncome += row.total;
      }
    }
  }

  // Salary accrues day by day, even while its payment status is "expected".
  // Future days are excluded; the Salary page still tracks whether it was paid.
  const salaryCtc = salaryRecords
    .reduce(
      (sum, record) => sum + earnedSalaryPaise(record, ctcPaiseFor(record), range.from, range.to, earnedToDate),
      0
    );
  const salaryInHand = salaryRecords
    .reduce(
      (sum, record) => sum + earnedSalaryPaise(record, netPaiseFor(record), range.from, range.to, earnedToDate),
      0
    );
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
    .reduce((sum, record) => sum + earnedSalaryPaise(record, ctcPaiseFor(record), earnedFromDate, earnedToDate, earnedToDate), 0);
  const earnedFreelanceGross = earnedWorkLogs.reduce(
    (sum, log) => sum + workLogValuePaise(log, clientById.get(log.clientId.toString()), usdInrRate),
    0
  );
  const totalMoneyEarned = earnedSalaryCtc + earnedShopIncome + earnedPersonalIncome + earnedFreelanceGross;

  // The average cards use gross earned money, not the selected period's cash-flow total.
  // Re-query only when the selected average has a different earning window.
  async function grossEarnedBetween(from: string, to: string): Promise<number> {
    if (from > to) return 0;
    const [transactionGroups, salaries, workLogs] = await Promise.all([
      db.collection<TransactionDoc>("transactions").aggregate<TypeGroupResult>([
        { $match: buildDateRangeFilter(from, to) },
        { $group: { _id: { module: "$module", type: "$type", category: "$category" }, total: { $sum: "$amountPaise" } } },
      ]).toArray(),
      db.collection<SalaryRecordDoc>("salary_records").find({ month: { $gte: from.slice(0, 7), $lte: to.slice(0, 7) } }).toArray(),
      db.collection<WorkLogDoc>("work_logs").find({ date: { $gte: from, $lte: to } }).toArray(),
    ]);
    const transactionIncome = transactionGroups.reduce((sum, row) => {
      if (row._id.type !== "income") return sum;
      if (row._id.module === "personal" && [SHOP_DRAW_CATEGORY, "money_return"].includes(row._id.category)) return sum;
      return sum + row.total;
    }, 0);
    return transactionIncome
      + salaries.reduce((sum, record) => sum + earnedSalaryPaise(record, ctcPaiseFor(record), from, to, earnedToDate), 0)
      + workLogs.reduce((sum, log) => sum + workLogValuePaise(log, clientById.get(log.clientId.toString()), usdInrRate), 0);
  }

  const yesterday = new Date(`${earnedToDate}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayDate = yesterday.toISOString().slice(0, 10);
  const [fiscalGross, yearThroughYesterdayGross] = await Promise.all([
    parsed.data.period === "fy" ? grossEarnedBetween(startOfFinancialYear(earnedToDate), earnedToDate) : Promise.resolve(0),
    parsed.data.period === "year" ? grossEarnedBetween(earnedFromDate, yesterdayDate) : Promise.resolve(0),
  ]);
  const incomeAverage = overviewIncomeAverage(parsed.data.period, earnedToDate, totalMoneyEarned, fiscalGross, yearThroughYesterdayGross);

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
    incomeAverage,
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
