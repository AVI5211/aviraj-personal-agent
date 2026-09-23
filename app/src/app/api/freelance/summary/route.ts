import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { freelanceSummaryQuerySchema } from "@/lib/validation";
import { resolvePeriod } from "@/lib/dates";
import { PLACEHOLDER_USD_TO_INR_RATE, type ClientDoc, type InvoiceDoc, type LeadExpenseDoc, type WorkLogDoc } from "@/lib/freelance";

function buildDateFilter(field: string, from: string | null, to: string | null): Record<string, unknown> {
  if (!from && !to) return {};
  const range: Record<string, string> = {};
  if (from) range.$gte = from;
  if (to) range.$lte = to;
  return { [field]: range };
}

export async function GET(request: NextRequest) {
  const query = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = freelanceSummaryQuerySchema.safeParse(query);
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

  const [paidInvoices, issuedInvoices, unbilledWorkLogs, leadExpensesInRange] = await Promise.all([
    db
      .collection<InvoiceDoc>("invoices")
      .find({ status: "paid", ...buildDateFilter("paidDate", range.from, range.to) })
      .toArray(),
    db.collection<InvoiceDoc>("invoices").find({ status: "issued" }).toArray(),
    db.collection<WorkLogDoc>("work_logs").find({ invoiced: false }).toArray(),
    db
      .collection<LeadExpenseDoc>("lead_expenses")
      .find({ ...buildDateFilter("date", range.from, range.to) })
      .toArray(),
  ]);

  const receivedPaise = paidInvoices.reduce((sum, inv) => sum + inv.netInrPaise, 0);
  const taxPaidPaise = paidInvoices.reduce((sum, inv) => sum + inv.taxPaidPaise, 0);
  const inHandReceivedPaise = receivedPaise - taxPaidPaise;
  const pendingPaise = issuedInvoices.reduce((sum, inv) => sum + inv.netInrPaise, 0);

  const byPlatform: Record<string, number> = { upwork: 0, deel: 0, other: 0 };
  for (const inv of paidInvoices) {
    byPlatform[inv.paymentPlatform] = (byPlatform[inv.paymentPlatform] ?? 0) + inv.netInrPaise;
  }
  const unbilledHours = unbilledWorkLogs.reduce((sum, log) => sum + log.billableHours, 0);
  const leadExpensesPaise = leadExpensesInRange.reduce((sum, exp) => sum + exp.amountPaise, 0);

  // Best-effort snapshot of unbilled work in INR: group by client currency so
  // INR clients sum directly (their hourlyRateMinor is already in paise) and
  // USD clients get converted using a rough placeholder exchange rate, since
  // no real rate exists until an invoice is actually issued.
  let unbilledAmountEstimatePaise = 0;
  if (unbilledWorkLogs.length > 0) {
    const clientIds = [...new Set(unbilledWorkLogs.map((log) => log.clientId.toString()))];
    const clients = await db
      .collection<ClientDoc>("clients")
      .find({ _id: { $in: unbilledWorkLogs.map((log) => log.clientId) } })
      .toArray();
    const clientById = new Map(clients.map((c) => [c._id.toString(), c]));

    for (const clientId of clientIds) {
      const client = clientById.get(clientId);
      if (!client) continue;
      const hours = unbilledWorkLogs
        .filter((log) => log.clientId.toString() === clientId)
        .reduce((sum, log) => sum + log.billableHours, 0);
      const amountMinor = hours * client.hourlyRateMinor;
      unbilledAmountEstimatePaise +=
        client.currency === "INR" ? amountMinor : Math.round(amountMinor * PLACEHOLDER_USD_TO_INR_RATE);
    }
  }

  return NextResponse.json({
    range,
    receivedPaise,
    inHandReceivedPaise,
    taxPaidPaise,
    pendingPaise,
    unbilledHours,
    unbilledAmountEstimatePaise,
    leadExpensesPaise,
    byPlatform,
  });
}
