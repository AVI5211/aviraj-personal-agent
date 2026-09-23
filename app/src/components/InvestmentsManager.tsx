"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { InvestmentApi, InvestmentHoldingType, InvestmentSummaryResponse, InvestmentValuationApi } from "@/lib/types";
import { formatPaiseAsInr } from "@/lib/money";

const HOLDING_TYPES: { value: InvestmentHoldingType; label: string }[] = [
  { value: "equity", label: "Equity" },
  { value: "mutual_fund", label: "Mutual Fund" },
  { value: "fixed_deposit", label: "Fixed Deposit" },
  { value: "savings", label: "Savings" },
  { value: "other", label: "Other" },
];

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function InvestmentsManager() {
  const [investments, setInvestments] = useState<InvestmentApi[]>([]);
  const [summary, setSummary] = useState<InvestmentSummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [history, setHistory] = useState<InvestmentValuationApi[]>([]);

  const [name, setName] = useState("");
  const [holdingType, setHoldingType] = useState<InvestmentHoldingType>("equity");
  const [currentValue, setCurrentValue] = useState("");
  const [investedValue, setInvestedValue] = useState("");
  const [valuationDate, setValuationDate] = useState(todayStr());
  const [maturityDate, setMaturityDate] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [note, setNote] = useState("");

  async function fetchAll() {
    const [invRes, summaryRes] = await Promise.all([fetch("/api/investments"), fetch("/api/investments/summary")]);
    if (invRes.ok) {
      const data = await invRes.json();
      setInvestments(data.investments);
    }
    if (summaryRes.ok) {
      setSummary(await summaryRes.json());
    }
  }

  useEffect(() => {
    fetchAll();
  }, []);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const currentValuePaise = Math.round(Number(currentValue) * 100);
    if (!Number.isFinite(currentValuePaise) || currentValuePaise < 0) {
      setError("Enter a valid non-negative current value");
      return;
    }

    const investedValuePaise = investedValue.trim() === "" ? null : Math.round(Number(investedValue) * 100);
    if (investedValuePaise !== null && (!Number.isFinite(investedValuePaise) || investedValuePaise < 0)) {
      setError("Enter a valid non-negative invested value");
      return;
    }

    const interestRateAnnualBps = interestRate.trim() === "" ? null : Math.round(Number(interestRate) * 100);

    setSubmitting(true);
    const response = await fetch("/api/investments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        holdingType,
        currentValuePaise,
        investedValuePaise,
        valuationDate,
        maturityDate: holdingType === "fixed_deposit" && maturityDate ? maturityDate : null,
        interestRateAnnualBps: holdingType === "fixed_deposit" ? interestRateAnnualBps : null,
        note,
      }),
    });
    setSubmitting(false);

    if (!response.ok) {
      setError("Could not add the holding");
      return;
    }

    setName("");
    setCurrentValue("");
    setInvestedValue("");
    setValuationDate(todayStr());
    setMaturityDate("");
    setInterestRate("");
    setNote("");
    fetchAll();
  }

  async function handleUpdateValuation(investment: InvestmentApi) {
    const valueInput = window.prompt("New current value (INR)", (investment.currentValuePaise / 100).toString());
    if (valueInput === null) return;
    const amount = Number(valueInput);
    if (!Number.isFinite(amount) || amount < 0) return;

    const dateInput = window.prompt("Valuation date (YYYY-MM-DD)", todayStr());
    if (dateInput === null) return;

    await fetch(`/api/investments/${investment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentValuePaise: Math.round(amount * 100), valuationDate: dateInput }),
    });
    fetchAll();
  }

  async function handleEdit(investment: InvestmentApi) {
    const newName = window.prompt("Name", investment.name);
    if (newName === null) return;
    const newNote = window.prompt("Note", investment.note) ?? investment.note;

    await fetch(`/api/investments/${investment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, note: newNote }),
    });
    fetchAll();
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this holding? This cannot be undone.")) return;
    await fetch(`/api/investments/${id}`, { method: "DELETE" });
    if (historyFor === id) setHistoryFor(null);
    fetchAll();
  }

  async function handleShowHistory(id: string) {
    if (historyFor === id) {
      setHistoryFor(null);
      return;
    }
    const response = await fetch(`/api/investments/${id}`);
    if (response.ok) {
      const data = await response.json();
      setHistory(data.valuations);
      setHistoryFor(id);
    }
  }

  const grouped = HOLDING_TYPES.map((t) => ({
    type: t.value,
    label: t.label,
    items: investments.filter((i) => i.holdingType === t.value),
  })).filter((g) => g.items.length > 0);

  return (
    <div>
      {summary && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-600">Summary</h2>
          <div className="mb-4 flex flex-wrap gap-6">
            <div>
              <p className="text-xs text-slate-400">Current Value</p>
              <p className="text-lg font-semibold text-slate-800">{formatPaiseAsInr(summary.totalCurrentValuePaise)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Invested</p>
              <p className="text-lg font-semibold text-slate-800">{formatPaiseAsInr(summary.totalInvestedValuePaise)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Gain / Loss</p>
              <p
                className={`text-lg font-semibold ${
                  summary.gainLossPaise === null
                    ? "text-slate-400"
                    : summary.gainLossPaise >= 0
                      ? "text-green-600"
                      : "text-red-600"
                }`}
              >
                {summary.gainLossPaise === null ? "Unknown" : formatPaiseAsInr(summary.gainLossPaise)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {HOLDING_TYPES.filter((t) => summary.byType[t.value] > 0).map((t) => (
              <div key={t.value} className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-400">{t.label}</p>
                <p className="text-sm font-medium text-slate-700">{formatPaiseAsInr(summary.byType[t.value])}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-600">Holdings</h2>

        {grouped.length === 0 && <p className="py-4 text-sm text-slate-500">No holdings yet — add one below.</p>}

        {grouped.map((group) => (
          <div key={group.type} className="mb-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{group.label}</h3>
            <div className="divide-y divide-slate-100">
              {group.items.map((investment) => {
                const gainLoss =
                  investment.investedValuePaise === null
                    ? null
                    : investment.currentValuePaise - investment.investedValuePaise;
                return (
                  <div key={investment.id} className="py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <button
                          type="button"
                          onClick={() => handleShowHistory(investment.id)}
                          className="text-sm font-medium text-slate-800 hover:underline"
                        >
                          {investment.name}
                        </button>
                        <p className="text-xs text-slate-400">
                          Valued {investment.valuationDate}
                          {investment.holdingType === "fixed_deposit" && investment.maturityDate
                            ? ` · Matures ${investment.maturityDate}`
                            : ""}
                          {investment.holdingType === "fixed_deposit" && investment.interestRateAnnualBps !== null
                            ? ` · ${(investment.interestRateAnnualBps / 100).toFixed(2)}% p.a.`
                            : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-800">
                            {formatPaiseAsInr(investment.currentValuePaise)}
                          </p>
                          {gainLoss !== null && (
                            <p className={`text-xs font-medium ${gainLoss >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {gainLoss >= 0 ? "+" : ""}
                              {formatPaiseAsInr(gainLoss)}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleUpdateValuation(investment)}
                          className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                        >
                          Update valuation
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEdit(investment)}
                          className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(investment.id)}
                          className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    {historyFor === investment.id && (
                      <div className="mt-2 rounded-md bg-slate-50 p-2">
                        <p className="mb-1 text-xs font-semibold text-slate-500">Valuation history</p>
                        {history.length === 0 && <p className="text-xs text-slate-400">No history yet.</p>}
                        <ul className="space-y-1">
                          {history.map((h) => (
                            <li key={h.id} className="flex justify-between text-xs text-slate-600">
                              <span>{h.valuationDate}</span>
                              <span>{formatPaiseAsInr(h.valuePaise)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-600">Add Holding</h2>
        <form onSubmit={handleAdd} className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. HDFC Mid-Cap Fund"
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Type</label>
            <select
              value={holdingType}
              onChange={(e) => setHoldingType(e.target.value as InvestmentHoldingType)}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              {HOLDING_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Current Value (INR)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={currentValue}
              onChange={(e) => setCurrentValue(e.target.value)}
              className="w-full sm:w-32 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Invested (INR, optional)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={investedValue}
              onChange={(e) => setInvestedValue(e.target.value)}
              className="w-full sm:w-32 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Valuation Date</label>
            <input
              type="date"
              required
              value={valuationDate}
              onChange={(e) => setValuationDate(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          {holdingType === "fixed_deposit" && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Maturity Date</label>
                <input
                  type="date"
                  value={maturityDate}
                  onChange={(e) => setMaturityDate(e.target.value)}
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Interest Rate (% p.a.)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                  className="w-full sm:w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
              </div>
            </>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Note</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
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
