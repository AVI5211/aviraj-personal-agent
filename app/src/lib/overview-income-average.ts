import { startOfFinancialYear, startOfYear, type Period } from "@/lib/dates";

export interface IncomeAverage {
  label: string;
  value: number;
}

function dayCount(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

function completedMonths(from: string, today: string): number {
  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [todayYear, todayMonth] = today.split("-").map(Number);
  return Math.max(1, (todayYear - fromYear) * 12 + todayMonth - fromMonth);
}

export function overviewIncomeAverage(
  period: Period,
  today: string,
  yearGross: number,
  fiscalGross = 0,
  yearThroughYesterdayGross = 0
): IncomeAverage | null {
  const elapsedDays = dayCount(startOfYear(today), today);
  switch (period) {
    case "today":
      return { label: "Average Daily Income", value: Math.round(yearGross / elapsedDays) };
    case "week":
      return { label: "Average Weekly Income", value: Math.round((yearGross * 7) / elapsedDays) };
    case "month":
      return { label: "Average Monthly Income", value: Math.round(yearGross / completedMonths(startOfYear(today), today)) };
    case "year":
      return {
        label: "Average Daily Income (This Year)",
        value: elapsedDays > 1 ? Math.round(yearThroughYesterdayGross / (elapsedDays - 1)) : 0,
      };
    case "fy":
      return {
        label: "Average Monthly Income (This FY)",
        value: Math.round(fiscalGross / completedMonths(startOfFinancialYear(today), today)),
      };
    case "yesterday":
    case "all":
    case "custom":
      return null;
  }
}
