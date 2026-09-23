export const SHOP_TZ = "Asia/Kolkata";

export type Period = "today" | "week" | "month" | "lastMonth" | "year" | "fy" | "custom" | "all";

export interface DateRange {
  from: string | null;
  to: string | null;
}

const DATE_STRING_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateString(value: string): boolean {
  if (!DATE_STRING_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function todayInShopTz(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SHOP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function parseDateString(value: string): { y: number; m: number; d: number } {
  const [y, m, d] = value.split("-").map(Number);
  return { y, m, d };
}

function toUtcDate(value: string): Date {
  const { y, m, d } = parseDateString(value);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatUtcDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function startOfWeek(dateStr: string): string {
  const date = toUtcDate(dateStr);
  const day = date.getUTCDay();
  const diffFromMonday = (day + 6) % 7;
  date.setUTCDate(date.getUTCDate() - diffFromMonday);
  return formatUtcDate(date);
}

export function startOfMonth(dateStr: string): string {
  const { y, m } = parseDateString(dateStr);
  return formatUtcDate(new Date(Date.UTC(y, m - 1, 1)));
}

export function startOfYear(dateStr: string): string {
  const { y } = parseDateString(dateStr);
  return formatUtcDate(new Date(Date.UTC(y, 0, 1)));
}

/** Indian financial year: 1 April to 31 March. Returns the start date of the FY containing dateStr. */
export function startOfFinancialYear(dateStr: string): string {
  const { y, m } = parseDateString(dateStr);
  const fyStartYear = m >= 4 ? y : y - 1;
  return formatUtcDate(new Date(Date.UTC(fyStartYear, 3, 1)));
}

/** Label like "2026-27" for the financial year starting in fyStartYear. */
export function financialYearLabel(fyStartYear: number): string {
  return `${fyStartYear}-${String((fyStartYear + 1) % 100).padStart(2, "0")}`;
}

export function previousMonthRange(dateStr: string): { from: string; to: string } {
  const { y, m } = parseDateString(dateStr);
  const firstOfThisMonth = new Date(Date.UTC(y, m - 1, 1));
  const lastOfPrevMonth = new Date(firstOfThisMonth.getTime());
  lastOfPrevMonth.setUTCDate(0);
  const firstOfPrevMonth = new Date(Date.UTC(lastOfPrevMonth.getUTCFullYear(), lastOfPrevMonth.getUTCMonth(), 1));
  return { from: formatUtcDate(firstOfPrevMonth), to: formatUtcDate(lastOfPrevMonth) };
}

export function resolvePeriod(
  period: Period,
  custom?: { from?: string; to?: string },
  now: Date = new Date()
): DateRange {
  const today = todayInShopTz(now);

  switch (period) {
    case "today":
      return { from: today, to: today };
    case "week":
      return { from: startOfWeek(today), to: today };
    case "month":
      return { from: startOfMonth(today), to: today };
    case "lastMonth": {
      const { from, to } = previousMonthRange(today);
      return { from, to };
    }
    case "year":
      return { from: startOfYear(today), to: today };
    case "fy":
      return { from: startOfFinancialYear(today), to: today };
    case "all":
      return { from: null, to: null };
    case "custom": {
      if (!custom?.from || !custom?.to || !isValidDateString(custom.from) || !isValidDateString(custom.to)) {
        throw new Error("Custom period requires valid 'from' and 'to' dates (YYYY-MM-DD)");
      }
      if (custom.from > custom.to) {
        throw new Error("'from' date must not be after 'to' date");
      }
      return { from: custom.from, to: custom.to };
    }
    default: {
      const exhaustiveCheck: never = period;
      throw new Error(`Unknown period: ${String(exhaustiveCheck)}`);
    }
  }
}

export function monthsBack(count: number, now: Date = new Date()): string[] {
  const today = todayInShopTz(now);
  const { y, m } = parseDateString(today);
  const months: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(Date.UTC(y, m - 1 - i, 1));
    const label = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    months.push(label);
  }
  return months;
}
