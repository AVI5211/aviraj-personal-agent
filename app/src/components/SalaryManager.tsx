"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { SalaryRecordApi, SalaryStatus } from "@/lib/types";
import { formatPaiseAsInr } from "@/lib/money";

function currentMonthValue(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit" })
    .format(new Date())
    .slice(0, 7);
}

export function SalaryManager() {
  const [records, setRecords] = useState<SalaryRecordApi[]>([]);
  const [month, setMonth] = useState(currentMonthValue());
  const [gross, setGross] = useState("");
  const [deductions, setDeductions] = useState("0");
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

  useEffect(() => {
    fetchRecords();
  }, []);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const grossAmount = Number(gross);
    const deductionsAmount = Number(deductions || "0");
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
        deductionsPaise: Math.round(deductionsAmount * 100),
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
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this salary record?")) return;
    await fetch(`/api/salary/${id}`, { method: "DELETE" });
    fetchRecords();
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Salary</h1>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-600">Monthly Salary Records</h2>

        <div className="mb-4 divide-y divide-slate-100">
          {records.length === 0 && <p className="py-4 text-sm text-slate-500">No salary records yet.</p>}
          {records.map((record) => (
            <div key={record.id} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-slate-800">{record.month}</p>
                <p className="text-xs text-slate-400">
                  Gross {formatPaiseAsInr(record.grossPaise)} − Deductions {formatPaiseAsInr(record.deductionsPaise)} ·{" "}
                  {record.status}
                </p>
              </div>
              <div className="flex items-center gap-2">
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

        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
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
            <label className="mb-1 block text-xs font-medium text-slate-700">Gross (INR)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={gross}
              onChange={(e) => setGross(e.target.value)}
              className="w-32 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Deductions (INR)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={deductions}
              onChange={(e) => setDeductions(e.target.value)}
              className="w-32 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
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
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Add
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
