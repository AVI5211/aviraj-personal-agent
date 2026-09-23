"use client";

import type { Period } from "@/lib/types";

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "lastMonth", label: "Last Month" },
  { value: "year", label: "This Year" },
  { value: "fy", label: "This FY" },
  { value: "all", label: "All Time" },
  { value: "custom", label: "Custom" },
];

interface PeriodFilterProps {
  period: Period;
  customFrom: string;
  customTo: string;
  onPeriodChange: (period: Period) => void;
  onCustomFromChange: (value: string) => void;
  onCustomToChange: (value: string) => void;
}

export function PeriodFilter({
  period,
  customFrom,
  customTo,
  onPeriodChange,
  onCustomFromChange,
  onCustomToChange,
}: PeriodFilterProps) {
  return (
    <div className="grid w-full grid-cols-[repeat(4,minmax(0,1fr))] gap-1 rounded-lg border border-emerald-200 bg-emerald-50 p-1.5 sm:w-auto sm:grid-cols-none sm:flex sm:flex-wrap sm:items-center">
      {PERIOD_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onPeriodChange(option.value)}
          aria-pressed={period === option.value}
          className={`min-h-10 min-w-0 rounded-md px-1.5 py-1 text-xs font-semibold leading-tight transition-colors duration-200 sm:px-3 sm:text-sm ${
            period === option.value
              ? "bg-emerald-200 text-emerald-950 shadow-sm ring-1 ring-emerald-300"
              : "bg-white/70 text-slate-700 hover:bg-emerald-100 hover:text-emerald-950"
          }`}
        >
          {option.label}
        </button>
      ))}

      {period === "custom" && (
        <div className="col-span-4 grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 border-t border-emerald-200 pt-1.5 sm:flex sm:border-0 sm:pt-0">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => onCustomFromChange(e.target.value)}
            className="min-w-0 rounded-md border border-emerald-200 bg-white px-2 py-2 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
          <span className="text-xs font-medium text-emerald-800">to</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => onCustomToChange(e.target.value)}
            className="min-w-0 rounded-md border border-emerald-200 bg-white px-2 py-2 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </div>
      )}
    </div>
  );
}
