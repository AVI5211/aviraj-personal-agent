"use client";

import { useMemo, useState } from "react";
import type { Module, PaymentMethod, TransactionApi, TransactionType } from "@/lib/types";
import { formatPaiseAsInr } from "@/lib/money";

const CATEGORY_OPTIONS: Record<Module, string[]> = {
  shop: [
    "shop_sales",
    "stock",
    "rent",
    "electricity",
    "salary",
    "transport",
    "labor",
    "renovation",
    "maintenance",
    "equipment",
    "marketing",
    "packaging",
    "insurance",
    "fees_taxes",
    "other",
  ],
  personal: [
    "shop_draw",
    "groceries",
    "rent",
    "utilities",
    "transport",
    "health",
    "entertainment",
    "shopping",
    "other",
  ],
};
const PAYMENT_METHOD_OPTIONS: PaymentMethod[] = ["bharatpe", "cash", "bank_transfer", "other"];

export interface HistoryFilters {
  type: TransactionType | "";
  category: string;
  paymentMethod: PaymentMethod | "";
}

interface TransactionHistoryProps {
  module: Module;
  transactions: TransactionApi[];
  total: number;
  page: number;
  pageSize: number;
  filters: HistoryFilters;
  onFiltersChange: (filters: HistoryFilters) => void;
  onPageChange: (page: number) => void;
  onEdit: (transaction: TransactionApi) => void;
  onDeleted: () => void;
}

export function TransactionHistory({
  module,
  transactions,
  total,
  page,
  pageSize,
  filters,
  onFiltersChange,
  onPageChange,
  onEdit,
  onDeleted,
}: TransactionHistoryProps) {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const groups = useMemo(() => {
    const byDate = new Map<string, TransactionApi[]>();
    for (const tx of transactions) {
      const list = byDate.get(tx.transactionDate) ?? [];
      list.push(tx);
      byDate.set(tx.transactionDate, list);
    }
    return Array.from(byDate.entries());
  }, [transactions]);

  async function confirmDelete(id: string) {
    const response = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    setPendingDeleteId(null);
    if (response.ok) {
      onDeleted();
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={filters.type}
          onChange={(e) => onFiltersChange({ ...filters, type: e.target.value as TransactionType | "" })}
          className="rounded-md border border-slate-300 px-2 py-1 text-sm"
        >
          <option value="">All types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>

        <select
          value={filters.category}
          onChange={(e) => onFiltersChange({ ...filters, category: e.target.value })}
          className="rounded-md border border-slate-300 px-2 py-1 text-sm"
        >
          <option value="">All categories</option>
          {CATEGORY_OPTIONS[module].map((c) => (
            <option key={c} value={c}>
              {c.replace("_", " ")}
            </option>
          ))}
        </select>

        <select
          value={filters.paymentMethod}
          onChange={(e) => onFiltersChange({ ...filters, paymentMethod: e.target.value as PaymentMethod | "" })}
          className="rounded-md border border-slate-300 px-2 py-1 text-sm"
        >
          <option value="">All payment methods</option>
          {PAYMENT_METHOD_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m.replace("_", " ")}
            </option>
          ))}
        </select>
      </div>

      {groups.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No transactions found.</p>}

      <div className="space-y-4">
        {groups.map(([date, dayTransactions]) => (
          <div key={date}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{date}</h3>
            <div className="divide-y divide-slate-100">
              {dayTransactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {tx.category.replace("_", " ")}
                      <span className="ml-2 text-xs text-slate-400">{tx.paymentMethod.replace("_", " ")}</span>
                    </p>
                    {tx.description && <p className="truncate text-xs text-slate-500">{tx.description}</p>}
                  </div>
                  <span className={`text-sm font-semibold ${tx.type === "income" ? "text-emerald-600" : "text-red-600"}`}>
                    {tx.type === "income" ? "+" : "-"}
                    {formatPaiseAsInr(tx.amountPaise)}
                  </span>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => onEdit(tx)}
                      className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDeleteId(tx.id)}
                      className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="rounded-md px-2 py-1 disabled:opacity-40"
          >
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="rounded-md px-2 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {pendingDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
            <p className="mb-4 text-sm text-slate-700">Delete this transaction? This cannot be undone.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPendingDeleteId(null)}
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmDelete(pendingDeleteId)}
                className="flex-1 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
