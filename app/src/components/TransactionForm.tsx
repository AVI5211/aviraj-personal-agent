"use client";

import { useState, type FormEvent } from "react";
import type { Module, PaymentMethod, TransactionApi, TransactionType } from "@/lib/types";

const SHOP_EXPENSE_CATEGORIES = [
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
];
const PERSONAL_EXPENSE_CATEGORIES = [
  "groceries",
  "rent",
  "utilities",
  "transport",
  "health",
  "entertainment",
  "shopping",
  "security_deposit",
  "other",
];
const PERSONAL_INCOME_CATEGORIES = [
  { value: "shop_draw", label: "Money drawn from shop" },
  { value: "other", label: "Other income" },
];
const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "bharatpe", label: "BharatPe" },
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "other", label: "Other" },
];

function todayLocalDateValue(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

function defaultCategoryFor(module: Module, type: TransactionType): string {
  if (type === "income") return module === "personal" ? "other" : "shop_sales";
  return module === "shop" ? "stock" : "groceries";
}

interface TransactionFormProps {
  module: Module;
  type: TransactionType;
  existing?: TransactionApi;
  initialCategory?: string;
  onClose: () => void;
  onSaved: () => void;
}

export function TransactionForm({ module, type, existing, initialCategory, onClose, onSaved }: TransactionFormProps) {
  const isEdit = Boolean(existing);
  const [amount, setAmount] = useState(existing ? (existing.amountPaise / 100).toString() : "");
  const [date, setDate] = useState(existing?.transactionDate ?? todayLocalDateValue());
  const [category, setCategory] = useState(existing?.category ?? initialCategory ?? defaultCategoryFor(module, type));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(existing?.paymentMethod ?? "cash");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const expenseCategories = module === "shop" ? SHOP_EXPENSE_CATEGORIES : PERSONAL_EXPENSE_CATEGORIES;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const amountNumber = Number(amount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      setError("Enter a valid amount greater than 0");
      return;
    }

    setSubmitting(true);
    const payload = {
      amountPaise: Math.round(amountNumber * 100),
      category,
      paymentMethod,
      transactionDate: date,
      description,
    };

    const response = await fetch(isEdit ? `/api/transactions/${existing!.id}` : "/api/transactions", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isEdit ? payload : { ...payload, module, type }),
    });

    setSubmitting(false);

    if (!response.ok) {
      setError("Could not save the transaction. Check the values and try again.");
      return;
    }

    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold">
          {isEdit ? "Edit" : "Add"} {type === "income" ? "Income" : "Expense"}
        </h2>

        <label className="mb-1 block text-sm font-medium text-slate-700">Amount (INR)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />

        <label className="mb-1 block text-sm font-medium text-slate-700">Date</label>
        <input
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />

        {type === "expense" && (
          <>
            <label className="mb-1 block text-sm font-medium text-slate-700">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {expenseCategories.map((c) => (
                <option key={c} value={c}>
                  {c.replace("_", " ")}
                </option>
              ))}
            </select>
          </>
        )}

        {type === "income" && module === "personal" && (
          <>
            <label className="mb-1 block text-sm font-medium text-slate-700">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {PERSONAL_INCOME_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </>
        )}

        <label className="mb-1 block text-sm font-medium text-slate-700">Payment Method</label>
        <select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
          className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          {PAYMENT_METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>

        <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional note"
          className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
