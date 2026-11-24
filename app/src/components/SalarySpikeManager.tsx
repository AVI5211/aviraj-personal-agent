"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { SalarySlipApi } from "@/lib/types";
import { formatPaiseAsInr } from "@/lib/money";
import { financialYearLabel, startOfFinancialYear, todayInShopTz } from "@/lib/dates";

function currentMonthValue(): string {
  return todayInShopTz().slice(0, 7);
}

function fyStartYearOf(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return m >= 4 ? y : y - 1;
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
}

// Period selector values: "all", "cy:<year>" (calendar year), or "fy:<startYear>".
function inPeriod(month: string, periodKey: string): boolean {
  if (periodKey === "all") return true;
  const [kind, value] = periodKey.split(":");
  return kind === "fy" ? fyStartYearOf(month) === Number(value) : month.startsWith(`${value}-`);
}

export function SalarySpikeManager() {
  const [slips, setSlips] = useState<SalarySlipApi[]>([]);
  const [periodKey, setPeriodKey] = useState(`fy:${startOfFinancialYear(todayInShopTz()).slice(0, 4)}`);
  const [viewing, setViewing] = useState<SalarySlipApi | null>(null);

  const [month, setMonth] = useState(currentMonthValue());
  const [gross, setGross] = useState("");
  const [deductions, setDeductions] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function fetchSlips() {
    const response = await fetch("/api/salary-slips");
    if (!response.ok) return;
    const data: { salarySlips: SalarySlipApi[] } = await response.json();
    setSlips(data.salarySlips);
    // Slips usually repeat month to month, so carry the latest figures into the form once.
    const latest = data.salarySlips[0];
    if (latest) {
      setGross((current) => current || String(latest.grossPaise / 100));
      setDeductions((current) => current || String(latest.deductionsPaise / 100));
    }
  }

  useEffect(() => {
    fetchSlips();
  }, []);

  useEffect(() => {
    if (!viewing) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setViewing(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewing]);

  async function handleUpload(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!file) {
      setError("Choose the PDF slip for this month");
      return;
    }
    const existing = slips.find((s) => s.month === month);
    if (existing && !window.confirm(`Replace the slip already saved for ${monthLabel(month)}?`)) return;

    const body = new FormData();
    body.set("month", month);
    body.set("gross", gross);
    body.set("deductions", deductions);
    body.set("file", file);

    setSubmitting(true);
    const response = await fetch("/api/salary-slips", { method: "POST", body });
    setSubmitting(false);
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(typeof data?.error === "string" ? data.error : "Could not upload the slip");
      return;
    }
    setFile(null);
    setFileInputKey((k) => k + 1);
    fetchSlips();
  }

  async function handleDelete(slip: SalarySlipApi) {
    if (!window.confirm(`Delete the slip for ${monthLabel(slip.month)}?`)) return;
    await fetch(`/api/salary-slips/${slip.month}`, { method: "DELETE" });
    setViewing(null);
    fetchSlips();
  }

  const fyStartYears = Array.from(new Set([fyStartYearOf(currentMonthValue()), ...slips.map((s) => fyStartYearOf(s.month))])).sort((a, b) => b - a);
  const calendarYears = Array.from(new Set([currentMonthValue().slice(0, 4), ...slips.map((s) => s.month.slice(0, 4))])).sort().reverse();

  const inRange = slips.filter((s) => inPeriod(s.month, periodKey));
  const totalGross = inRange.reduce((sum, s) => sum + s.grossPaise, 0);
  const totalDeductions = inRange.reduce((sum, s) => sum + s.deductionsPaise, 0);
  const totalNet = totalGross - totalDeductions;
  const averageNet = inRange.length > 0 ? Math.round(totalNet / inRange.length) : 0;

  return (
    <div>
      <div className="mb-6 flex items-center gap-2">
        <h1 className="text-xl font-semibold">Salary</h1>
        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">V2 · Salary slips</span>
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-600">Salary Overview</h2>
          <select
            value={periodKey}
            onChange={(e) => setPeriodKey(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs"
          >
            <optgroup label="Financial Year">
              {fyStartYears.map((fy) => (
                <option key={`fy:${fy}`} value={`fy:${fy}`}>
                  FY {financialYearLabel(fy)}
                </option>
              ))}
            </optgroup>
            <optgroup label="Calendar Year">
              {calendarYears.map((y) => (
                <option key={`cy:${y}`} value={`cy:${y}`}>
                  {y} (Calendar)
                </option>
              ))}
            </optgroup>
            <option value="all">All time</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <OverviewCard label="Total Earnings" value={totalGross} />
          <OverviewCard label="Total Deductions" value={totalDeductions} tone="negative" />
          <OverviewCard label="Total Net Pay" value={totalNet} tone="positive" />
          <OverviewCard label={`Avg Net / Month (${inRange.length})`} value={averageNet} />
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold text-slate-600">Monthly Salary Slips</h2>
        <p className="mb-3 text-xs text-slate-400">Tap a month to open its slip.</p>

        <div className="mb-4 divide-y divide-slate-100">
          {slips.length === 0 && <p className="py-4 text-sm text-slate-500">No salary slips uploaded yet.</p>}
          {slips.map((slip) => (
            <button
              key={slip.id}
              type="button"
              onClick={() => setViewing(slip)}
              className="flex min-h-12 w-full items-center justify-between gap-3 rounded-md px-1 py-2 text-left hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-300"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">{monthLabel(slip.month)}</p>
                <p className="text-xs text-slate-400">
                  Earnings {formatPaiseAsInr(slip.grossPaise)} · Deductions {formatPaiseAsInr(slip.deductionsPaise)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-sm font-semibold text-emerald-600">{formatPaiseAsInr(slip.netPaise)}</span>
                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">PDF</span>
              </div>
            </button>
          ))}
        </div>

        <form onSubmit={handleUpload} className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Month</label>
            <input
              type="month"
              required
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Total Earnings (INR)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={gross}
              onChange={(e) => setGross(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm sm:w-36"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Total Deductions (INR)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={deductions}
              onChange={(e) => setDeductions(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm sm:w-36"
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="mb-1 block text-xs font-medium text-slate-700">Slip PDF</label>
            <input
              key={fileInputKey}
              type="file"
              accept="application/pdf,.pdf"
              required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1.5 file:text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="col-span-2 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 sm:col-span-1"
          >
            {submitting ? "Uploading..." : "Upload"}
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      {viewing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Salary slip for ${monthLabel(viewing.month)}`}
          className="fixed inset-0 z-50 flex flex-col bg-slate-900/70 p-0 sm:p-6"
          onClick={() => setViewing(null)}
        >
          <div
            className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden bg-white sm:rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{monthLabel(viewing.month)}</p>
                <p className="text-xs text-slate-500">Net {formatPaiseAsInr(viewing.netPaise)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <a
                  href={`/api/salary-slips/${viewing.month}`}
                  target="_blank"
                  rel="noopener"
                  className="rounded-md px-2 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                >
                  Full screen
                </a>
                <button
                  type="button"
                  onClick={() => handleDelete(viewing)}
                  className="rounded-md px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setViewing(null)}
                  className="min-h-9 min-w-9 rounded-md text-lg text-slate-600 hover:bg-slate-100"
                >
                  ×
                </button>
              </div>
            </div>
            <iframe title={`Salary slip ${viewing.month}`} src={`/api/salary-slips/${viewing.month}`} className="h-full w-full flex-1" />
          </div>
        </div>
      )}
    </div>
  );
}

function OverviewCard({ label, value, tone }: { label: string; value: number; tone?: "positive" | "negative" }) {
  const color = tone === "positive" ? "text-emerald-600" : tone === "negative" ? "text-red-600" : "text-slate-800";
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-base font-semibold ${color}`}>{formatPaiseAsInr(value)}</p>
    </div>
  );
}
