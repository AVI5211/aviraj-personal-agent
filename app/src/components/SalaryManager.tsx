"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { SalaryOverviewResponse, SalaryRecordApi, SalaryStatus } from "@/lib/types";
import { formatPaiseAsInr } from "@/lib/money";

function currentMonthValue(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit" })
    .format(new Date())
    .slice(0, 7);
}

function currentYearValue(): string {
  return currentMonthValue().slice(0, 4);
}

export function SalaryManager() {
  const [records, setRecords] = useState<SalaryRecordApi[]>([]);
  const [overview, setOverview] = useState<SalaryOverviewResponse | null>(null);
  const [year, setYear] = useState(currentYearValue());
  const [prefilled, setPrefilled] = useState(false);

  const [month, setMonth] = useState(currentMonthValue());
  const [gross, setGross] = useState("");
  const [deductions, setDeductions] = useState("0");
  const [pfEmployee, setPfEmployee] = useState("0");
  const [pfEmployer, setPfEmployer] = useState("0");
  const [tds, setTds] = useState("0");
  const [recurringPf, setRecurringPf] = useState(false);
  const [recurringTds, setRecurringTds] = useState(false);
  const [status, setStatus] = useState<SalaryStatus>("received");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function fetchRecords() {
    const response = await fetch("/api/salary");
    if (response.ok) {
      const data = await response.json();
      setRecords(data.salaryRecords);
    }
  }

  async function fetchOverview(forYear: string) {
    const params = forYear === "all" ? "" : `?year=${forYear}`;
    const response = await fetch(`/api/salary/summary${params}`);
    if (response.ok) setOverview(await response.json());
  }

  useEffect(() => {
    fetchRecords();
  }, []);

  useEffect(() => {
    fetchOverview(year);
  }, [year]);

  // Carry forward PF/TDS amounts from the most recent record, but only for fields the
  // user explicitly marked as recurring, and only once (so it never fights user edits).
  useEffect(() => {
    if (prefilled || records.length === 0) return;
    const latest = records[0];
    if (latest.recurringPf) {
      setPfEmployee((latest.pfEmployeePaise / 100).toString());
      setPfEmployer((latest.pfEmployerPaise / 100).toString());
      setRecurringPf(true);
    }
    if (latest.recurringTds) {
      setTds((latest.tdsPaise / 100).toString());
      setRecurringTds(true);
    }
    setPrefilled(true);
  }, [records, prefilled]);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const grossAmount = Number(gross);
    if (!Number.isFinite(grossAmount) || grossAmount <= 0) {
      setError("Enter a valid gross salary amount");
      return;
    }

    setSubmitting(true);
    const response = await fetch("/api/salary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        month,
        grossPaise: Math.round(grossAmount * 100),
        deductionsPaise: Math.round(Number(deductions || "0") * 100),
        pfEmployeePaise: Math.round(Number(pfEmployee || "0") * 100),
        pfEmployerPaise: Math.round(Number(pfEmployer || "0") * 100),
        tdsPaise: Math.round(Number(tds || "0") * 100),
        recurringPf,
        recurringTds,
        status,
      }),
    });
    setSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error && typeof data.error === "string" ? data.error : "Could not add the salary record");
      return;
    }

    setGross("");
    setDeductions("0");
    fetchRecords();
    fetchOverview(year);
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this salary record?")) return;
    await fetch(`/api/salary/${id}`, { method: "DELETE" });
    fetchRecords();
    fetchOverview(year);
  }

  const years = Array.from(new Set(records.map((r) => r.month.slice(0, 4)))).sort().reverse();

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Salary</h1>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-600">Salary Overview</h2>
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs"
          >
            <option value={currentYearValue()}>{currentYearValue()}</option>
            {years.filter((y) => y !== currentYearValue()).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
            <option value="all">All time</option>
          </select>
        </div>

        {overview && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <OverviewCard label="Total CTC" value={overview.totalCtcPaise} />
            <OverviewCard label="Total Gross" value={overview.totalGrossPaise} />
            <OverviewCard label="Total In-Hand" value={overview.totalInHandPaise} tone="positive" />
            <OverviewCard label="Total Deductions" value={overview.totalDeductionsPaise} tone="negative" />
            <OverviewCard label="Total Tax Paid (TDS)" value={overview.totalTaxPaidPaise} tone="negative" />
            <OverviewCard label="Total PF (Employee)" value={overview.totalPfEmployeePaise} />
            <OverviewCard label="Total PF (Employer)" value={overview.totalPfEmployerPaise} />
            <OverviewCard label="Other Deductions" value={overview.totalOtherDeductionsPaise} />
          </div>
        )}
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-600">Monthly Salary Records</h2>

        <div className="mb-4 divide-y divide-slate-100">
          {records.length === 0 && <p className="py-4 text-sm text-slate-500">No salary records yet.</p>}
          {records.map((record) => (
            <div key={record.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800">{record.month}</p>
                <p className="text-xs text-slate-400">
                  CTC {formatPaiseAsInr(record.ctcPaise)} · PF {formatPaiseAsInr(record.pfEmployeePaise)} · TDS{" "}
                  {formatPaiseAsInr(record.tdsPaise)} · {record.status}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-sm font-semibold text-emerald-600">{formatPaiseAsInr(record.netPaise)}</span>
                <button
                  type="button"
                  onClick={() => handleDelete(record.id)}
                  className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleAdd} className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end">
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
            <label className="mb-1 block text-xs font-medium text-slate-700">Gross Salary (INR)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={gross}
              onChange={(e) => setGross(e.target.value)}
              className="w-full sm:w-32 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">PF Deduction — Employee (INR)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={pfEmployee}
              onChange={(e) => setPfEmployee(e.target.value)}
              className="w-full sm:w-36 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">PF Added — Employer (INR)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={pfEmployer}
              onChange={(e) => setPfEmployer(e.target.value)}
              className="w-full sm:w-36 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex items-center gap-1 pb-2">
            <input
              id="recurringPf"
              type="checkbox"
              checked={recurringPf}
              onChange={(e) => setRecurringPf(e.target.checked)}
            />
            <label htmlFor="recurringPf" className="text-xs text-slate-600">
              PF recurring
            </label>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">TDS Cut (INR)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={tds}
              onChange={(e) => setTds(e.target.value)}
              className="w-full sm:w-32 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex items-center gap-1 pb-2">
            <input
              id="recurringTds"
              type="checkbox"
              checked={recurringTds}
              onChange={(e) => setRecurringTds(e.target.checked)}
            />
            <label htmlFor="recurringTds" className="text-xs text-slate-600">
              TDS recurring
            </label>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Other Deductions (INR)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={deductions}
              onChange={(e) => setDeductions(e.target.value)}
              className="w-full sm:w-32 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as SalaryStatus)}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="expected">Expected</option>
              <option value="received">Received</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="col-span-2 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 sm:col-span-1"
          >
            Add
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
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
