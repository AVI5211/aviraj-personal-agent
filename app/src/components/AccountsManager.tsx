"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { AccountApi, AccountType } from "@/lib/types";
import { formatPaiseAsInr } from "@/lib/money";

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "bank", label: "Bank" },
  { value: "cash", label: "Cash" },
  { value: "investment", label: "Investment" },
  { value: "pf", label: "Provident Fund" },
  { value: "other_asset", label: "Other Asset" },
  { value: "loan", label: "Loan (liability)" },
];

export function AccountsManager() {
  const [accounts, setAccounts] = useState<AccountApi[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("bank");
  const [balance, setBalance] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function fetchAccounts() {
    const response = await fetch("/api/accounts");
    if (response.ok) {
      const data = await response.json();
      setAccounts(data.accounts);
    }
  }

  useEffect(() => {
    fetchAccounts();
  }, []);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const amount = Number(balance);
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Enter a valid non-negative balance");
      return;
    }

    setSubmitting(true);
    const response = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type, balancePaise: Math.round(amount * 100) }),
    });
    setSubmitting(false);

    if (!response.ok) {
      setError("Could not add the account");
      return;
    }

    setName("");
    setBalance("");
    fetchAccounts();
  }

  async function handleUpdateBalance(id: string, currentPaise: number) {
    const input = window.prompt("New balance (INR)", (currentPaise / 100).toString());
    if (input === null) return;
    const amount = Number(input);
    if (!Number.isFinite(amount) || amount < 0) return;

    await fetch(`/api/accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ balancePaise: Math.round(amount * 100) }),
    });
    fetchAccounts();
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this account? This cannot be undone.")) return;
    await fetch(`/api/accounts/${id}`, { method: "DELETE" });
    fetchAccounts();
  }

  return (
    <div className="mb-8 rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-600">Accounts & Balances</h2>

      <div className="mb-4 divide-y divide-slate-100">
        {accounts.length === 0 && <p className="py-4 text-sm text-slate-500">No accounts yet — add one below.</p>}
        {accounts.map((account) => (
          <div key={account.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800">{account.name}</p>
              <p className="text-xs text-slate-400">{ACCOUNT_TYPES.find((t) => t.value === account.type)?.label}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className={`text-sm font-semibold ${account.type === "loan" ? "text-red-600" : "text-slate-800"}`}>
                {formatPaiseAsInr(account.balancePaise)}
              </span>
              <button
                type="button"
                onClick={() => handleUpdateBalance(account.id, account.balancePaise)}
                className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Update
              </button>
              <button
                type="button"
                onClick={() => handleDelete(account.id)}
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
          <label className="mb-1 block text-xs font-medium text-slate-700">Name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. HDFC Savings"
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as AccountType)}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            {ACCOUNT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Balance (INR)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            required
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            className="w-full sm:w-32 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
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
  );
}
