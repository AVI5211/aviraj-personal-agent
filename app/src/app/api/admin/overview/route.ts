import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ensureSeeded } from "@/lib/seed";
import { periodQuerySchema, SHOP_DRAW_CATEGORY } from "@/lib/validation";
import { resolvePeriod } from "@/lib/dates";
import { buildDateRangeFilter, type TransactionDoc } from "@/lib/transactions";
import { isLiability, type AccountDoc } from "@/lib/accounts";
import type { SalaryRecordDoc } from "@/lib/salary";
import type { InvestmentDoc } from "@/lib/investments";
import type { LoanDoc } from "@/lib/loans";
import type { InvoiceDoc } from "@/lib/freelance";

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

  const [byModuleTypeCategory, accounts, salaryRecords, investments, activeLoans, issuedInvoices, paidInvoices] =
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
      db.collection<AccountDoc>("accounts").find({}).toArray(),
      range.from && range.to
        ? db
            .collection<SalaryRecordDoc>("salary_records")
            .find({ month: { $gte: range.from.slice(0, 7), $lte: range.to.slice(0, 7) } })
            .toArray()
        : db.collection<SalaryRecordDoc>("salary_records").find({}).toArray(),
      db.collection<InvestmentDoc>("investments").find({}).toArray(),
      db.collection<LoanDoc>("loans").find({ status: "active" }).toArray(),
      db.collection<InvoiceDoc>("invoices").find({ status: "issued" }).toArray(),
      range.from && range.to
        ? db
            .collection<InvoiceDoc>("invoices")
            .find({ status: "paid", paidDate: { $gte: range.from, $lte: range.to } })
            .toArray()
        : db.collection<InvoiceDoc>("invoices").find({ status: "paid" }).toArray(),
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
  const freelanceIncome = paidInvoices.reduce((sum, invoice) => sum + invoice.netInrPaise, 0);
  const receivables = issuedInvoices.reduce((sum, invoice) => sum + invoice.netInrPaise, 0);

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

  const netWorth = cashAndBank + investmentsTotal + pfTotal + otherAssetsTotal - liabilitiesTotal;

  return NextResponse.json({
    range,
    netWorth,
    cashAndBank,
    investmentsTotal,
    pfTotal,
    otherAssetsTotal,
    liabilitiesTotal,
    monthlyIncome: salaryIncome + shopDrawIncome + personalOtherIncome + freelanceIncome,
    monthlyExpense: personalExpense,
    incomeSources: {
      salary: salaryIncome,
      shop: shopDrawIncome,
      freelance: freelanceIncome,
    },
    shopNetCashFlow: shopIncome - shopExpense,
    receivables,
  });
}
