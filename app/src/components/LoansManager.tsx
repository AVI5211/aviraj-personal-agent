"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { LoanApi, LoanPaymentApi, RecurringExpenseApi } from "@/lib/types";
import { formatPaiseAsInr } from "@/lib/money";

function toPaise(value: string): number | null {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}

export function LoansManager() {
  const [loans, setLoans] = useState<LoanApi[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpenseApi[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [lender, setLender] = useState("");
  const [originalPrincipal, setOriginalPrincipal] = useState("");
  const [monthlyEmi, setMonthlyEmi] = useState("");
  const [dueDayOfMonth, setDueDayOfMonth] = useState("5");
  const [startDate, setStartDate] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [expenseName, setExpenseName] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDueDay, setExpenseDueDay] = useState("5");
  const [expenseStartDate, setExpenseStartDate] = useState("");
  const [expenseSubmitting, setExpenseSubmitting] = useState(false);

  async function fetchLoans() {
    const response = await fetch("/api/loans");
    if (response.ok) {
      const data = await response.json();
      setLoans(data.loans);
    }
  }

  async function fetchRecurringExpenses() {
    const response = await fetch("/api/recurring-expenses");
    if (response.ok) {
      const data = await response.json();
      setRecurringExpenses(data.recurringExpenses);
    }
  }

  useEffect(() => {
    fetchLoans();
    fetchRecurringExpenses();
  }, []);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const principalPaise = toPaise(originalPrincipal);
    const emiPaise = toPaise(monthlyEmi);
    const day = Number(dueDayOfMonth);

    if (principalPaise === null || emiPaise === null) {
      setError("Enter valid non-negative amounts");
      return;
    }
    if (!startDate) {
      setError("Start date is required");
      return;
    }

    setSubmitting(true);
    const response = await fetch("/api/loans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lender,
        originalPrincipalPaise: principalPaise,
        monthlyEmiPaise: emiPaise,
        dueDayOfMonth: day,
        startDate,
        interestRateAnnualBps: interestRate ? Math.round(Number(interestRate) * 100) : null,
      }),
    });
    setSubmitting(false);

    if (!response.ok) {
      setError("Could not add the loan");
      return;
    }

    setLender("");
    setOriginalPrincipal("");
    setMonthlyEmi("");
    setDueDayOfMonth("5");
    setStartDate("");
    setInterestRate("");
    fetchLoans();
  }

  async function handleAddRecurringExpense(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const monthlyAmountPaise = toPaise(expenseAmount);
    if (monthlyAmountPaise === null || monthlyAmountPaise === 0) {
      setError("Enter a valid monthly expense amount");
      return;
    }

    setExpenseSubmitting(true);
    const response = await fetch("/api/recurring-expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: expenseName,
        monthlyAmountPaise,
        dueDayOfMonth: Number(expenseDueDay),
        startDate: expenseStartDate || null,
      }),
    });
    setExpenseSubmitting(false);

    if (!response.ok) {
      setError("Could not add the monthly fixed expense");
      return;
    }

    setExpenseName("");
    setExpenseAmount("");
    setExpenseDueDay("5");
    setExpenseStartDate("");
    fetchRecurringExpenses();
  }

  async function handleDeleteRecurringExpense(id: string) {
    if (!window.confirm("Delete this monthly fixed expense?")) return;
    const response = await fetch(`/api/recurring-expenses/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError("Could not delete the monthly fixed expense");
      return;
    }
    fetchRecurringExpenses();
  }

  async function handleUpdateOutstanding(id: string, currentPaise: number) {
    const input = window.prompt("Outstanding principal (INR)", (currentPaise / 100).toString());
    if (input === null) return;
    const paise = toPaise(input);
    if (paise === null) return;

    await fetch(`/api/loans/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outstandingPrincipalPaise: paise }),
    });
    fetchLoans();
  }

  async function handleToggleStatus(loan: LoanApi) {
    const nextStatus = loan.status === "active" ? "closed" : "active";
    await fetch(`/api/loans/${loan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    fetchLoans();
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this loan and all its payment history? This cannot be undone.")) return;
    await fetch(`/api/loans/${id}`, { method: "DELETE" });
    if (expandedId === id) setExpandedId(null);
    fetchLoans();
  }

  return (
    <div>
      <div className="mb-4 space-y-3">
        {loans.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
            No loans yet — add one below.
          </p>
        )}
        {loans.map((loan) => (
          <div key={loan.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">{loan.lender}</p>
                <p className="text-xs text-slate-400">
                  EMI {formatPaiseAsInr(loan.monthlyEmiPaise)} · due day {loan.dueDayOfMonth} ·{" "}
                  {loan.status === "active" ? "active" : "closed"}
                  {loan.interestRateAnnualBps !== null ? ` · ${(loan.interestRateAnnualBps / 100).toFixed(2)}% p.a.` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setExpandedId(expandedId === loan.id ? null : loan.id)}
                  className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  {expandedId === loan.id ? "Hide" : "Details"}
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleStatus(loan)}
                  className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  {loan.status === "active" ? "Mark closed" : "Reopen"}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(loan.id)}
                  className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <div>
                <p className="text-slate-400">Outstanding principal</p>
                <div className="flex items-center gap-1">
                  <p className="font-semibold text-red-600">{formatPaiseAsInr(loan.outstandingPrincipalPaise)}</p>
                  <button
                    type="button"
                    onClick={() => handleUpdateOutstanding(loan.id, loan.outstandingPrincipalPaise)}
                    className="text-slate-400 underline hover:text-slate-700"
                  >
                    edit
                  </button>
                </div>
              </div>
              <div>
                <p className="text-slate-400">Paid / Pending</p>
                <p className="font-semibold text-slate-800">
                  {loan.paidCount} / {loan.pendingCount}
                </p>
              </div>
              <div>
                <p className="text-slate-400">Total paid</p>
                <p className="font-semibold text-slate-800">{formatPaiseAsInr(loan.totalPaidPaise)}</p>
              </div>
              <div>
                <p className="text-slate-400">Scheduled remaining (projection)</p>
                <p className="font-semibold text-slate-800">{formatPaiseAsInr(loan.scheduledRemainingPaise)}</p>
              </div>
            </div>

            {expandedId === loan.id && <LoanPaymentSchedule loan={loan} onChanged={fetchLoans} />}
          </div>
        ))}
      </div>

      <form onSubmit={handleAdd} className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-600">Add Loan</h2>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Lender</label>
            <input
              type="text"
              required
              value={lender}
              onChange={(e) => setLender(e.target.value)}
              placeholder="e.g. HDFC Bank"
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Principal (INR)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={originalPrincipal}
              onChange={(e) => setOriginalPrincipal(e.target.value)}
              className="w-full sm:w-32 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Monthly EMI (INR)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={monthlyEmi}
              onChange={(e) => setMonthlyEmi(e.target.value)}
              className="w-full sm:w-28 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Due day</label>
            <input
              type="number"
              min="1"
              max="31"
              required
              value={dueDayOfMonth}
              onChange={(e) => setDueDayOfMonth(e.target.value)}
              className="w-full sm:w-16 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Start date</label>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Interest %/yr</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={interestRate}
              onChange={(e) => setInterestRate(e.target.value)}
              placeholder="optional"
              className="w-full sm:w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="col-span-2 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 sm:col-span-1"
          >
            Add
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </form>

      <section className="mt-6">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-slate-700">Monthly fixed expenses</h2>
          <p className="mt-1 text-xs text-slate-500">
            Track regular bills such as rent, subscriptions, or utilities separately from loans. These are planned amounts and do not automatically create a paid transaction.
          </p>
        </div>

        <div className="mb-3 space-y-2">
          {recurringExpenses.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
              No monthly fixed expenses yet — add one below.
            </p>
          ) : (
            recurringExpenses.map((expense) => (
              <div key={expense.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{expense.name}</p>
                  <p className="text-xs text-slate-500">
                    {formatPaiseAsInr(expense.monthlyAmountPaise)} every month · due day {expense.dueDayOfMonth}
                    {expense.startDate ? ` · starts ${expense.startDate}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteRecurringExpense(expense.id)}
                  className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>

        <form onSubmit={handleAddRecurringExpense} className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-600">Add monthly fixed expense</h3>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Expense name</label>
              <input type="text" required value={expenseName} onChange={(e) => setExpenseName(e.target.value)} placeholder="e.g. House rent" className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm sm:w-40" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Monthly amount (INR)</label>
              <input type="number" min="0.01" step="0.01" required value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm sm:w-32" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Due day</label>
              <input type="number" min="1" max="31" required value={expenseDueDay} onChange={(e) => setExpenseDueDay(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm sm:w-16" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Start date</label>
              <input type="date" value={expenseStartDate} onChange={(e) => setExpenseStartDate(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
            </div>
            <button type="submit" disabled={expenseSubmitting} className="col-span-2 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 sm:col-span-1">
              {expenseSubmitting ? "Adding…" : "Add expense"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function LoanPaymentSchedule({ loan, onChanged }: { loan: LoanApi; onChanged: () => void }) {
  const [payments, setPayments] = useState<LoanPaymentApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [dueDate, setDueDate] = useState("");
  const [amount, setAmount] = useState("");

  async function fetchPayments() {
    setLoading(true);
    const response = await fetch(`/api/loans/${loan.id}`);
    if (response.ok) {
      const data = await response.json();
      setPayments(data.payments);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loan.id]);

  async function handleAddPayment(event: FormEvent) {
    event.preventDefault();
    if (!dueDate) return;
    const amountPaise = amount ? toPaise(amount) : undefined;

    await fetch(`/api/loans/${loan.id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dueDate, amountPaise }),
    });
    setDueDate("");
    setAmount("");
    fetchPayments();
    onChanged();
  }

  async function handleMarkPaid(payment: LoanPaymentApi) {
    const paidDateInput = window.prompt("Paid date (YYYY-MM-DD)", payment.dueDate);
    if (!paidDateInput) return;
    const amountInput = window.prompt("Amount paid (INR)", (payment.amountPaise / 100).toString());
    if (amountInput === null) return;
    const amountPaise = toPaise(amountInput);
    if (amountPaise === null) return;

    await fetch(`/api/loans/${loan.id}/payments/${payment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paidDate: paidDateInput, amountPaise }),
    });
    fetchPayments();
    onChanged();
  }

  async function handleDeletePayment(payment: LoanPaymentApi) {
    if (!window.confirm("Delete this scheduled payment?")) return;
    await fetch(`/api/loans/${loan.id}/payments/${payment.id}`, { method: "DELETE" });
    fetchPayments();
    onChanged();
  }

  async function handleGenerate() {
    await fetch(`/api/loans/${loan.id}/payments/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ months: 12 }),
    });
    fetchPayments();
    onChanged();
  }

  return (
    <div className="mt-4 border-t border-slate-100 pt-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-600">Payment schedule</h3>
        <button
          type="button"
          onClick={handleGenerate}
          className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
        >
          Generate next 12 months
        </button>
      </div>

      {loading && <p className="text-xs text-slate-400">Loading…</p>}
      {!loading && payments.length === 0 && <p className="text-xs text-slate-400">No payments scheduled yet.</p>}

      {!loading && payments.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400">
                <th className="py-1 pr-2">Due date</th>
                <th className="py-1 pr-2">Amount</th>
                <th className="py-1 pr-2">Status</th>
                <th className="py-1 pr-2">Paid date</th>
                <th className="py-1 pr-2"></th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className="border-t border-slate-50">
                  <td className="py-1 pr-2">{payment.dueDate}</td>
                  <td className="py-1 pr-2">{formatPaiseAsInr(payment.amountPaise)}</td>
                  <td className="py-1 pr-2">
                    <span
                      className={
                        payment.status === "paid" ? "font-medium text-green-600" : "font-medium text-amber-600"
                      }
                    >
                      {payment.status}
                    </span>
                  </td>
                  <td className="py-1 pr-2">{payment.paidDate ?? "-"}</td>
                  <td className="py-1 pr-2">
                    {payment.status === "scheduled" ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleMarkPaid(payment)}
                          className="text-slate-600 underline hover:text-slate-900"
                        >
                          Mark paid
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePayment(payment)}
                          className="text-red-600 underline hover:text-red-800"
                        >
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={handleAddPayment} className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Due date</label>
          <input
            type="date"
            required
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-xs"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Amount (INR)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`default ${(loan.monthlyEmiPaise / 100).toFixed(2)}`}
            className="w-full sm:w-32 rounded-md border border-slate-300 px-2 py-1.5 text-xs"
          />
        </div>
        <button
          type="submit"
          className="col-span-2 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white sm:col-span-1"
        >
          Add payment
        </button>
      </form>
    </div>
  );
}
