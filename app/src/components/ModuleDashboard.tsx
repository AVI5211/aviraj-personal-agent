"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TransactionHistory, type HistoryFilters } from "@/components/TransactionHistory";
import { TransactionForm } from "@/components/TransactionForm";
import { PeriodFilter } from "@/components/PeriodFilter";
import { TrendChart } from "@/components/TrendChart";
import { ReceivablesManager } from "@/components/ReceivablesManager";
import { resolvePeriod } from "@/lib/dates";
import { formatPaiseAsInr } from "@/lib/money";
import type { Module, Period, SummaryResponse, TransactionApi, TrendPoint } from "@/lib/types";

const PAGE_SIZE = 20;

interface ModuleDashboardProps {
  module: Module;
  title: string;
}

export function ModuleDashboard({ module, title }: ModuleDashboardProps) {
  const [period, setPeriod] = useState<Period>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [trends, setTrends] = useState<TrendPoint[]>([]);

  const [transactions, setTransactions] = useState<TransactionApi[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<HistoryFilters>({ type: "", category: "", paymentMethod: "" });

  const [formState, setFormState] = useState<{
    type: "income" | "expense";
    existing?: TransactionApi;
    initialCategory?: string;
  } | null>(null);

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
    const params = new URLSearchParams({ module, period });
    if (period === "custom") {
      params.set("from", customFrom);
      params.set("to", customTo);
    }
    const response = await fetch(`/api/reports/summary?${params.toString()}`);
    if (response.ok) setSummary(await response.json());
  }, [module, period, customFrom, customTo, canQuery]);

  const fetchTransactions = useCallback(async () => {
    if (!canQuery) return;
    const params = new URLSearchParams({ module, page: String(page), pageSize: String(PAGE_SIZE) });
    if (module !== "personal") {
      if (range.from) params.set("from", range.from);
      if (range.to) params.set("to", range.to);
    }
    if (filters.type) params.set("type", filters.type);
    if (filters.category) params.set("category", filters.category);
    if (filters.paymentMethod) params.set("paymentMethod", filters.paymentMethod);

    const response = await fetch(`/api/transactions?${params.toString()}`);
    if (response.ok) {
      const data = await response.json();
      setTransactions(data.transactions);
      setTotal(data.total);
    }
  }, [module, page, filters, range, canQuery]);

  const fetchTrends = useCallback(async () => {
    const response = await fetch(`/api/reports/trends?module=${module}&months=12`);
    if (response.ok) {
      const data = await response.json();
      setTrends(data.trends);
    }
  }, [module]);

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

  return (
    <div>
      <div className="mb-6"><p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Money workspace</p><h1 className="text-2xl font-bold tracking-tight text-slate-950">{title}</h1></div>

      <div className="mb-6">
        <PeriodFilter
          period={period}
          customFrom={customFrom}
          customTo={customTo}
          onPeriodChange={setPeriod}
          onCustomFromChange={(value) => {
            setCustomFrom(value);
            if (!customTo) setCustomTo(value);
          }}
          onCustomToChange={(value) => {
            setCustomTo(value);
            if (!customFrom) setCustomFrom(value);
          }}
        />
      </div>

      {summary && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
          <SummaryCard label="Total Income" value={summary.totalIncome} tone="positive" />
          <SummaryCard label="Total Expense" value={summary.totalExpense} tone="negative" />
          <SummaryCard
            label={module === "personal" ? "Money lent & refundable deposits" : "Net Cash Flow"}
            value={module === "personal" ? summary.totalReceivables ?? 0 : summary.netCashFlow}
            tone={module === "personal" ? undefined : summary.netCashFlow >= 0 ? "positive" : "negative"}
          />
          {module === "shop" && (
            <>
              <SummaryCard label="BharatPe" value={summary.incomeByMethod.bharatpe ?? 0} />
              <SummaryCard label="Cash" value={summary.incomeByMethod.cash ?? 0} />
              <SummaryCard label="Bank Transfer" value={summary.incomeByMethod.bank_transfer ?? 0} />
              <SummaryCard label="Opening Balance" value={summary.openingBalance} />
              <SummaryCard label="Closing Balance" value={summary.closingBalance} />
            </>
          )}
        </div>
      )}

      {module === "personal" && <ReceivablesManager onChanged={handleSaved} />}

      <div className="mb-6 flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white/75 p-3 shadow-sm">
        <button
          onClick={() => setFormState({ type: "income" })}
          className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
        >
          + Add Income
        </button>
        <button
          onClick={() => setFormState({ type: "expense" })}
          className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
        >
          + Add Expense
        </button>
        {module === "personal" && (
          <button
            onClick={() => setFormState({ type: "expense", initialCategory: "security_deposit" })}
            className="w-full rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 sm:flex-1"
          >
            + Money Lent / Deposit
          </button>
        )}
      </div>

      <div className="mb-6">
        <h2 className="mb-2 text-base font-bold text-slate-900">Monthly Trend</h2>
        <TrendChart trends={trends} showMoneyLent={module === "personal"} />
      </div>

      <div>
        <h2 className="mb-2 text-base font-bold text-slate-900">History</h2>
        <TransactionHistory
          module={module}
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
          module={module}
          type={formState.type}
          existing={formState.existing}
          initialCategory={formState.initialCategory}
          onClose={() => setFormState(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
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
    <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-bold tracking-tight tabular-nums ${color}`}>{formatPaiseAsInr(value)}</p>
    </div>
  );
}
