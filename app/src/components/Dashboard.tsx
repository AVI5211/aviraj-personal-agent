"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TransactionHistory, type HistoryFilters } from "@/components/TransactionHistory";
import { TransactionForm } from "@/components/TransactionForm";
import { PeriodFilter } from "@/components/PeriodFilter";
import { TrendChart } from "@/components/TrendChart";
import { resolvePeriod } from "@/lib/dates";
import { formatPaiseAsInr } from "@/lib/money";
import type { Period, SummaryResponse, TransactionApi, TrendPoint } from "@/lib/types";

const PAGE_SIZE = 20;

export function Dashboard() {
  const router = useRouter();

  const [period, setPeriod] = useState<Period>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [trends, setTrends] = useState<TrendPoint[]>([]);

  const [transactions, setTransactions] = useState<TransactionApi[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<HistoryFilters>({ type: "", category: "", paymentMethod: "" });

  const [formState, setFormState] = useState<{ type: "income" | "expense"; existing?: TransactionApi } | null>(null);

  const canQuery = period !== "custom" || Boolean(customFrom && customTo);

  const range = useMemo(() => {
    try {
      return resolvePeriod(period, { from: customFrom, to: customTo });
    } catch {
      return { from: null, to: null };
    }
  }, [period, customFrom, customTo]);

  const fetchSummary = useCallback(async () => {
    if (!canQuery) return;
    const params = new URLSearchParams({ period });
    if (period === "custom") {
      params.set("from", customFrom);
      params.set("to", customTo);
    }
    const response = await fetch(`/api/reports/summary?${params.toString()}`);
    if (response.ok) setSummary(await response.json());
  }, [period, customFrom, customTo, canQuery]);

  const fetchTransactions = useCallback(async () => {
    if (!canQuery) return;
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (range.from) params.set("from", range.from);
    if (range.to) params.set("to", range.to);
    if (filters.type) params.set("type", filters.type);
    if (filters.category) params.set("category", filters.category);
    if (filters.paymentMethod) params.set("paymentMethod", filters.paymentMethod);

    const response = await fetch(`/api/transactions?${params.toString()}`);
    if (response.ok) {
      const data = await response.json();
      setTransactions(data.transactions);
      setTotal(data.total);
    }
  }, [page, filters, range, canQuery]);

  const fetchTrends = useCallback(async () => {
    const response = await fetch("/api/reports/trends?months=12");
    if (response.ok) {
      const data = await response.json();
      setTrends(data.trends);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    fetchTrends();
  }, [fetchTrends]);

  useEffect(() => {
    setPage(1);
  }, [period, customFrom, customTo, filters]);

  function handleSaved() {
    setFormState(null);
    fetchSummary();
    fetchTransactions();
    fetchTrends();
  }

  function handleDeleted() {
    fetchSummary();
    fetchTransactions();
    fetchTrends();
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Shop Hisab Kitab</h1>
        <button onClick={handleLogout} className="text-sm text-slate-500 hover:text-slate-800">
          Sign out
        </button>
      </div>

      <div className="mb-6">
        <PeriodFilter
          period={period}
          customFrom={customFrom}
          customTo={customTo}
          onPeriodChange={setPeriod}
          onCustomFromChange={setCustomFrom}
          onCustomToChange={setCustomTo}
        />
      </div>

      {summary && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <SummaryCard label="Total Income" value={summary.totalIncome} tone="positive" />
          <SummaryCard label="Total Expense" value={summary.totalExpense} tone="negative" />
          <SummaryCard
            label="Net Cash Flow"
            value={summary.netCashFlow}
            tone={summary.netCashFlow >= 0 ? "positive" : "negative"}
          />
          <SummaryCard label="BharatPe" value={summary.incomeByMethod.bharatpe ?? 0} />
          <SummaryCard label="Cash" value={summary.incomeByMethod.cash ?? 0} />
          <SummaryCard label="Bank Transfer" value={summary.incomeByMethod.bank_transfer ?? 0} />
          <SummaryCard label="Opening Balance" value={summary.openingBalance} />
          <SummaryCard label="Closing Balance" value={summary.closingBalance} />
        </div>
      )}

      <div className="mb-6 flex gap-3">
        <button
          onClick={() => setFormState({ type: "income" })}
          className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white"
        >
          + Add Income
        </button>
        <button
          onClick={() => setFormState({ type: "expense" })}
          className="flex-1 rounded-lg bg-red-600 px-4 py-3 text-sm font-semibold text-white"
        >
          + Add Expense
        </button>
      </div>

      <div className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-slate-600">Monthly Trend</h2>
        <TrendChart trends={trends} />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-600">History</h2>
        <TransactionHistory
          transactions={transactions}
          total={total}
          page={page}
          pageSize={PAGE_SIZE}
          filters={filters}
          onFiltersChange={setFilters}
          onPageChange={setPage}
          onEdit={(tx) => setFormState({ type: tx.type, existing: tx })}
          onDeleted={handleDeleted}
        />
      </div>

      {formState && (
        <TransactionForm
          type={formState.type}
          existing={formState.existing}
          onClose={() => setFormState(null)}
          onSaved={handleSaved}
        />
      )}
    </main>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "positive" | "negative";
}) {
  const color = tone === "positive" ? "text-emerald-600" : tone === "negative" ? "text-red-600" : "text-slate-800";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-lg font-semibold ${color}`}>{formatPaiseAsInr(value)}</p>
    </div>
  );
}
