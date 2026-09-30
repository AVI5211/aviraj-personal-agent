"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatPaiseAsInr, paiseToRupees } from "@/lib/money";
import type { EarningsChartPoint } from "@/lib/earnings-chart";

type Shortcut = "last7" | "month" | "lastMonth" | "year" | "fy";

interface ChartResponse {
  range: { from: string; to: string; granularity: "day" | "month" };
  points: EarningsChartPoint[];
}

const shortcuts: { value: Shortcut; label: string }[] = [
  { value: "last7", label: "Last 7 days" },
  { value: "month", label: "This month" },
  { value: "lastMonth", label: "Last month" },
  { value: "year", label: "This year" },
  { value: "fy", label: "This FY" },
];

function shortAmount(paise: number) {
  const rupees = paiseToRupees(paise);
  if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(1)}L`;
  if (rupees >= 1000) return `₹${Math.round(rupees / 1000)}k`;
  return `₹${Math.round(rupees)}`;
}

export function OverviewEarningsChart() {
  const [period, setPeriod] = useState<Shortcut>("last7");
  const [chart, setChart] = useState<ChartResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ period });
    setLoading(true);
    setError("");
    fetch(`/api/admin/earnings-chart?${params}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load earnings chart");
        return response.json() as Promise<ChartResponse>;
      })
      .then(setChart)
      .catch((reason) => { if (!controller.signal.aborted) setError(reason.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [period]);

  const points = chart?.points ?? [];
  const chartTotal = points.reduce((sum, point) => sum + point.total, 0);
  const data = points.map((point) => ({
    ...point,
    label: chart?.range.granularity === "day" ? point.date.slice(8) : point.date.slice(5),
    Salary: paiseToRupees(point.salary),
    Freelance: paiseToRupees(point.freelance),
    Shop: paiseToRupees(point.shop),
    Personal: paiseToRupees(point.personal),
  }));
  const hasIncome = chartTotal > 0;

  return (
    <section className="mb-6 min-w-0 rounded-xl border border-slate-200 bg-white p-4 sm:p-5" aria-label="Income trend">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Income trend</h2>
          <p className="mt-0.5 text-xs text-slate-500">Earnings in the chart range, by {chart?.range.granularity ?? "day"}</p>
        </div>
        <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <span>Show</span>
          <select
            aria-label="Income chart period"
            value={period}
            onChange={(event) => setPeriod(event.target.value as Shortcut)}
            className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          >
            {shortcuts.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>

      <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-2xl font-bold tabular-nums text-emerald-800">{loading ? "—" : formatPaiseAsInr(chartTotal)}</p>
        <p className="text-xs text-slate-500">{chart?.range.from} to {chart?.range.to}</p>
      </div>
      {loading ? (
        <div className="h-64 animate-pulse rounded-lg bg-slate-100" aria-label="Loading income chart" />
      ) : error ? (
        <p role="alert" className="py-12 text-center text-sm text-red-700">{error}. Change the period to retry.</p>
      ) : !hasIncome ? (
        <p className="py-12 text-center text-sm text-slate-500">No income recorded in this period.</p>
      ) : (
        <div className="h-64 w-full min-w-0 sm:h-72" role="img" aria-label={`Income chart with ${points.length} ${chart?.range.granularity === "day" ? "daily" : "monthly"} bars, totaling ${formatPaiseAsInr(chartTotal)}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="18%" accessibilityLayer>
              <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis dataKey="label" interval={points.length > 20 ? 4 : 0} tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
              <YAxis width={52} tickFormatter={(value: number) => shortAmount(Math.round(value * 100))} tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} />
              <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ""} formatter={(value: number, name: string) => [formatPaiseAsInr(Math.round(value * 100)), name]} />
              <Bar dataKey="Salary" stackId="income" fill="#047857" isAnimationActive={false} />
              <Bar dataKey="Freelance" stackId="income" fill="#2563eb" isAnimationActive={false} />
              <Bar dataKey="Shop" stackId="income" fill="#d97706" isAnimationActive={false} />
              <Bar dataKey="Personal" stackId="income" fill="#7c3aed" isAnimationActive={false} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600" aria-label="Income sources">
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-emerald-700" />Salary CTC</span>
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-blue-600" />Freelance work</span>
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-amber-600" />Shop</span>
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-violet-700" />Personal income</span>
      </div>
      <details className="mt-4 border-t border-slate-100 pt-3 text-sm">
        <summary className="cursor-pointer font-medium text-emerald-800">View exact values</summary>
        <div className="mt-2 max-h-64 overflow-y-auto">
          <table className="w-full text-left text-xs tabular-nums">
            <thead className="sticky top-0 bg-white text-slate-500"><tr><th className="py-2">Date</th><th className="py-2 text-right">Income</th></tr></thead>
            <tbody>{points.map((point) => <tr key={point.date} className="border-t border-slate-100"><td className="py-2">{point.date}</td><td className="py-2 text-right">{formatPaiseAsInr(point.total)}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
