import { previousMonthRange, resolvePeriod, startOfFinancialYear, startOfMonth, startOfYear, todayInShopTz, type Period } from "@/lib/dates";
import { ctcPaiseFor, type SalaryRecordDoc } from "@/lib/salary";
import type { ClientDoc, WorkLogDoc } from "@/lib/freelance";
import type { TransactionDoc } from "@/lib/transactions";
import { SHOP_DRAW_CATEGORY } from "@/lib/validation";

export type EarningsChartPeriod = Period | "last7" | "lastMonth";
export type EarningsChartPoint = {
  date: string;
  salary: number;
  freelance: number;
  shop: number;
  personal: number;
  total: number;
};

export function chartRange(period: EarningsChartPeriod, today = todayInShopTz(), custom?: { from: string; to: string }, allFrom?: string) {
  const current = new Date(`${today}T00:00:00.000Z`);
  if (period === "last7") {
    const first = new Date(current);
    first.setUTCDate(first.getUTCDate() - 7);
    const last = new Date(current);
    last.setUTCDate(last.getUTCDate() - 1);
    return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10), granularity: "day" as const };
  }
  if (period === "lastMonth") return { ...previousMonthRange(today), granularity: "day" as const };
  if (period === "month") {
    const end = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0));
    return { from: startOfMonth(today), to: end.toISOString().slice(0, 10), granularity: "day" as const };
  }
  if (period === "custom") {
    if (!custom) throw new Error("Custom chart period needs both dates");
    const range = resolvePeriod("custom", custom);
    const days = (Date.parse(`${range.to}T00:00:00Z`) - Date.parse(`${range.from}T00:00:00Z`)) / 86_400_000 + 1;
    return { from: range.from!, to: range.to!, granularity: days > 62 ? "month" as const : "day" as const };
  }
  if (period === "all") return { from: allFrom ?? startOfYear(today), to: today, granularity: "month" as const };
  if (period === "today" || period === "yesterday" || period === "week") {
    const range = resolvePeriod(period, undefined, current);
    return { from: range.from!, to: range.to!, granularity: "day" as const };
  }
  const from = period === "year" ? startOfYear(today) : startOfFinancialYear(today);
  // The current year/FY stops at today so future months do not appear earned.
  return { from, to: today, granularity: "month" as const };
}

function eachDay(from: string, to: string): string[] {
  const result: string[] = [];
  const day = new Date(`${from}T00:00:00.000Z`);
  while (day.toISOString().slice(0, 10) <= to) {
    result.push(day.toISOString().slice(0, 10));
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return result;
}

export function buildEarningsChart(
  period: EarningsChartPeriod,
  today: string,
  transactions: TransactionDoc[],
  salaries: SalaryRecordDoc[],
  workLogs: WorkLogDoc[],
  clients: ClientDoc[],
  usdInrRate: number,
  custom?: { from: string; to: string },
  allFrom?: string
): EarningsChartPoint[] {
  const { from, to, granularity } = chartRange(period, today, custom, allFrom);
  const dates = eachDay(from, to);
  const keys = granularity === "day" ? dates : [...new Set(dates.map((day) => day.slice(0, 7)))];
  const points = new Map(keys.map((date) => [date, { date, salary: 0, freelance: 0, shop: 0, personal: 0, total: 0 }]));
  const keyFor = (date: string) => granularity === "day" ? date : date.slice(0, 7);

  for (const record of salaries) {
    if (record.status !== "received") continue;
    const monthlyCtc = ctcPaiseFor(record);
    if (granularity === "month" && period !== "custom") {
      const point = points.get(record.month);
      if (point) point.salary += monthlyCtc;
      continue;
    }
    const [year, month] = record.month.split("-").map(Number);
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    if (granularity === "month") {
      const point = points.get(record.month);
      if (!point) continue;
      const monthFrom = `${record.month}-01`;
      const monthTo = `${record.month}-${String(daysInMonth).padStart(2, "0")}`;
      const first = from > monthFrom ? from : monthFrom;
      const last = to < monthTo ? to : monthTo;
      const days = Math.round((Date.parse(`${last}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / 86_400_000) + 1;
      point.salary += Math.round(monthlyCtc * Math.max(0, days) / daysInMonth);
      continue;
    }
    const includedDays: string[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const key = `${record.month}-${String(day).padStart(2, "0")}`;
      const point = points.get(keyFor(key));
      if (point) {
        includedDays.push(key);
        // Cumulative rounding allocates every paise of the monthly CTC exactly once.
        point.salary += Math.round(monthlyCtc * day / daysInMonth) - Math.round(monthlyCtc * (day - 1) / daysInMonth);
      }
    }
    // Daily/weekly/custom totals use the Overview's one-rounding-per-record rule.
    if (["today", "yesterday", "week", "last7", "custom"].includes(period) && includedDays.length > 0) {
      const target = Math.round(monthlyCtc * includedDays.length / daysInMonth);
      const actual = includedDays.reduce((sum, day) => sum + (points.get(keyFor(day))?.salary ?? 0), 0);
      points.get(keyFor(includedDays[includedDays.length - 1]))!.salary += target - actual;
    }
  }

  for (const transaction of transactions) {
    if (transaction.type !== "income") continue;
    const point = points.get(keyFor(transaction.transactionDate));
    if (!point) continue;
    if (transaction.module === "shop") point.shop += transaction.amountPaise;
    else if (transaction.category !== SHOP_DRAW_CATEGORY && transaction.category !== "money_return") {
      point.personal += transaction.amountPaise;
    }
  }

  const clientById = new Map(clients.map((client) => [client._id.toString(), client]));
  for (const log of workLogs) {
    const point = points.get(keyFor(log.date));
    const client = clientById.get(log.clientId.toString());
    if (!point || !client) continue;
    const rate = client.currency === "USD" ? usdInrRate : 1;
    point.freelance += Math.round(log.billableHours * client.hourlyRateMinor * rate);
  }

  return [...points.values()].map((point) => ({
    ...point,
    total: point.salary + point.freelance + point.shop + point.personal,
  }));
}
