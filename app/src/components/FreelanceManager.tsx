"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { PeriodFilter } from "@/components/PeriodFilter";
import { formatPaiseAsInr } from "@/lib/money";
import type {
  ClientApi,
  ClientCurrency,
  FreelanceSummaryResponse,
  InvoiceApi,
  LeadExpenseApi,
  LeadExpenseCategory,
  Period,
  WorkLogApi,
} from "@/lib/types";

function formatMinor(amountMinor: number, currency: ClientCurrency): string {
  if (currency === "INR") return formatPaiseAsInr(amountMinor);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amountMinor / 100);
}

const LEAD_EXPENSE_CATEGORIES: { value: LeadExpenseCategory; label: string }[] = [
  { value: "upwork_connects", label: "Upwork Connects" },
  { value: "subscription", label: "Subscription" },
  { value: "other", label: "Other" },
];

export function FreelanceManager() {
  const [period, setPeriod] = useState<Period>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [summary, setSummary] = useState<FreelanceSummaryResponse | null>(null);
  const [clients, setClients] = useState<ClientApi[]>([]);
  const [workLogs, setWorkLogs] = useState<WorkLogApi[]>([]);
  const [invoices, setInvoices] = useState<InvoiceApi[]>([]);
  const [leadExpenses, setLeadExpenses] = useState<LeadExpenseApi[]>([]);

  const [error, setError] = useState<string | null>(null);

  // New client form
  const [clientName, setClientName] = useState("");
  const [clientCurrency, setClientCurrency] = useState<ClientCurrency>("USD");
  const [clientRate, setClientRate] = useState("");
  const [clientNote, setClientNote] = useState("");

  // Work log inline form state, keyed by clientId
  const [logForms, setLogForms] = useState<Record<string, { date: string; billable: string; nonBillable: string; description: string }>>({});

  // Invoice selection
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [invoiceFees, setInvoiceFees] = useState("0");
  const [invoiceRate, setInvoiceRate] = useState("1");

  // Lead expense form
  const [leadDate, setLeadDate] = useState("");
  const [leadAmount, setLeadAmount] = useState("");
  const [leadCategory, setLeadCategory] = useState<LeadExpenseCategory>("upwork_connects");
  const [leadDescription, setLeadDescription] = useState("");

  const canQuery = period !== "custom" || Boolean(customFrom && customTo);

  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  const fetchSummary = useCallback(async () => {
    if (!canQuery) return;
    const params = new URLSearchParams({ period });
    if (period === "custom") {
      params.set("from", customFrom);
      params.set("to", customTo);
    }
    const response = await fetch(`/api/freelance/summary?${params.toString()}`);
    if (response.ok) setSummary(await response.json());
  }, [period, customFrom, customTo, canQuery]);

  const fetchClients = useCallback(async () => {
    const response = await fetch("/api/freelance/clients");
    if (response.ok) {
      const data = await response.json();
      setClients(data.clients);
    }
  }, []);

  const fetchWorkLogs = useCallback(async () => {
    const response = await fetch("/api/freelance/work-logs?invoiced=false");
    if (response.ok) {
      const data = await response.json();
      setWorkLogs(data.workLogs);
    }
  }, []);

  const fetchInvoices = useCallback(async () => {
    const response = await fetch("/api/freelance/invoices");
    if (response.ok) {
      const data = await response.json();
      setInvoices(data.invoices);
    }
  }, []);

  const fetchLeadExpenses = useCallback(async () => {
    const response = await fetch("/api/freelance/lead-expenses");
    if (response.ok) {
      const data = await response.json();
      setLeadExpenses(data.leadExpenses);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    fetchClients();
    fetchWorkLogs();
    fetchInvoices();
    fetchLeadExpenses();
  }, [fetchClients, fetchWorkLogs, fetchInvoices, fetchLeadExpenses]);

  function refreshAfterMutation() {
    fetchSummary();
    fetchWorkLogs();
    fetchInvoices();
  }

  async function handleAddClient(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const rate = Number(clientRate);
    if (!clientName.trim() || !Number.isFinite(rate) || rate <= 0) {
      setError("Enter a valid client name and hourly rate");
      return;
    }
    const response = await fetch("/api/freelance/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: clientName,
        currency: clientCurrency,
        hourlyRateMinor: Math.round(rate * 100),
        contractNote: clientNote,
      }),
    });
    if (!response.ok) {
      setError("Could not add client");
      return;
    }
    setClientName("");
    setClientRate("");
    setClientNote("");
    fetchClients();
  }

  async function handleDeleteClient(id: string) {
    if (!window.confirm("Delete this client?")) return;
    const response = await fetch(`/api/freelance/clients/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "Could not delete client");
      return;
    }
    fetchClients();
  }

  function getLogForm(clientId: string) {
    return logForms[clientId] ?? { date: "", billable: "", nonBillable: "0", description: "" };
  }

  function setLogForm(clientId: string, patch: Partial<{ date: string; billable: string; nonBillable: string; description: string }>) {
    setLogForms((prev) => ({ ...prev, [clientId]: { ...getLogForm(clientId), ...patch } }));
  }

  async function handleAddWorkLog(clientId: string, event: FormEvent) {
    event.preventDefault();
    setError(null);
    const form = getLogForm(clientId);
    const billable = Number(form.billable);
    const nonBillable = Number(form.nonBillable || "0");
    if (!form.date || !Number.isFinite(billable) || billable < 0) {
      setError("Enter a valid date and billable hours");
      return;
    }
    const response = await fetch("/api/freelance/work-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        date: form.date,
        billableHours: billable,
        nonBillableHours: nonBillable,
        description: form.description,
      }),
    });
    if (!response.ok) {
      setError("Could not log work");
      return;
    }
    setLogForms((prev) => ({ ...prev, [clientId]: { date: "", billable: "", nonBillable: "0", description: "" } }));
    fetchWorkLogs();
    fetchSummary();
  }

  function toggleLogSelection(id: string) {
    setSelectedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedLogs = workLogs.filter((log) => selectedLogIds.has(log.id));
  const selectedClientIds = new Set(selectedLogs.map((log) => log.clientId));
  const canIssueInvoice = selectedLogs.length > 0 && selectedClientIds.size === 1;

  async function handleIssueInvoice(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const fees = Number(invoiceFees);
    const rate = Number(invoiceRate);
    if (!Number.isFinite(fees) || fees < 0 || !Number.isFinite(rate) || rate <= 0) {
      setError("Enter valid fees and exchange rate");
      return;
    }
    const clientId = selectedLogs[0]?.clientId;
    if (!clientId) return;
    const client = clientById.get(clientId);
    const feesMinor = Math.round(fees * 100);

    const response = await fetch("/api/freelance/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        workLogIds: Array.from(selectedLogIds),
        feesMinor,
        exchangeRateToInr: client?.currency === "INR" ? 1 : rate,
      }),
    });
    if (!response.ok) {
      setError("Could not issue invoice");
      return;
    }
    setSelectedLogIds(new Set());
    setShowInvoiceForm(false);
    setInvoiceFees("0");
    setInvoiceRate("1");
    refreshAfterMutation();
  }

  async function handleMarkPaid(invoice: InvoiceApi) {
    const netInput = window.prompt("Net INR received (rupees)", "");
    if (netInput === null) return;
    const net = Number(netInput);
    if (!Number.isFinite(net) || net < 0) return;
    const paidDate = window.prompt("Paid date (YYYY-MM-DD)", new Date().toISOString().slice(0, 10));
    if (!paidDate) return;

    const response = await fetch(`/api/freelance/invoices/${invoice.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paid", netInrPaise: Math.round(net * 100), paidDate }),
    });
    if (!response.ok) {
      setError("Could not mark invoice paid");
      return;
    }
    refreshAfterMutation();
  }

  async function handleDeleteInvoice(id: string) {
    if (!window.confirm("Delete this invoice? Its work logs will become unbilled again.")) return;
    const response = await fetch(`/api/freelance/invoices/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "Could not delete invoice");
      return;
    }
    refreshAfterMutation();
  }

  async function handleAddLeadExpense(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const amount = Number(leadAmount);
    if (!leadDate || !Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid date and amount");
      return;
    }
    const response = await fetch("/api/freelance/lead-expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: leadDate,
        amountPaise: Math.round(amount * 100),
        category: leadCategory,
        description: leadDescription,
      }),
    });
    if (!response.ok) {
      setError("Could not add lead expense");
      return;
    }
    setLeadDate("");
    setLeadAmount("");
    setLeadDescription("");
    fetchLeadExpenses();
    fetchSummary();
  }

  async function handleDeleteLeadExpense(id: string) {
    if (!window.confirm("Delete this expense?")) return;
    await fetch(`/api/freelance/lead-expenses/${id}`, { method: "DELETE" });
    fetchLeadExpenses();
    fetchSummary();
  }

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold text-slate-800">Freelance</h1>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="mb-4">
        <PeriodFilter
          period={period}
          customFrom={customFrom}
          customTo={customTo}
          onPeriodChange={setPeriod}
          onCustomFromChange={setCustomFrom}
          onCustomToChange={setCustomTo}
        />
      </div>

      {/* Summary cards */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Received</p>
          <p className="mt-1 text-lg font-semibold text-emerald-600">
            {formatPaiseAsInr(summary?.receivedPaise ?? 0)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Pending</p>
          <p className="mt-1 text-lg font-semibold text-amber-600">
            {formatPaiseAsInr(summary?.pendingPaise ?? 0)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Unbilled Hours</p>
          <p className="mt-1 text-lg font-semibold text-slate-800">{summary?.unbilledHours ?? 0}</p>
          <p className="text-xs text-slate-400">
            ~{formatPaiseAsInr(summary?.unbilledAmountEstimatePaise ?? 0)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Lead Expenses</p>
          <p className="mt-1 text-lg font-semibold text-slate-800">
            {formatPaiseAsInr(summary?.leadExpensesPaise ?? 0)}
          </p>
        </div>
      </div>

      {/* Clients */}
      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-600">Clients</h2>

        <div className="mb-4 divide-y divide-slate-100">
          {clients.length === 0 && <p className="py-4 text-sm text-slate-500">No clients yet — add one below.</p>}
          {clients.map((client) => {
            const logForm = getLogForm(client.id);
            return (
              <div key={client.id} className="py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{client.name}</p>
                    <p className="text-xs text-slate-400">
                      {client.currency} · {formatMinor(client.hourlyRateMinor, client.currency)}/hr
                    </p>
                    {client.contractNote && <p className="text-xs text-slate-400">{client.contractNote}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteClient(client.id)}
                    className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>

                <form
                  onSubmit={(e) => handleAddWorkLog(client.id, e)}
                  className="mt-2 flex flex-wrap items-end gap-2 rounded-md bg-slate-50 p-2"
                >
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">Date</label>
                    <input
                      type="date"
                      required
                      value={logForm.date}
                      onChange={(e) => setLogForm(client.id, { date: e.target.value })}
                      className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">Billable hrs</label>
                    <input
                      type="number"
                      min="0"
                      step="0.25"
                      required
                      value={logForm.billable}
                      onChange={(e) => setLogForm(client.id, { billable: e.target.value })}
                      className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">Non-billable hrs</label>
                    <input
                      type="number"
                      min="0"
                      step="0.25"
                      value={logForm.nonBillable}
                      onChange={(e) => setLogForm(client.id, { nonBillable: e.target.value })}
                      className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-slate-700">Description</label>
                    <input
                      type="text"
                      value={logForm.description}
                      onChange={(e) => setLogForm(client.id, { description: e.target.value })}
                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white"
                  >
                    Log Work
                  </button>
                </form>
              </div>
            );
          })}
        </div>

        <form onSubmit={handleAddClient} className="flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Name</label>
            <input
              type="text"
              required
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Currency</label>
            <select
              value={clientCurrency}
              onChange={(e) => setClientCurrency(e.target.value as ClientCurrency)}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="USD">USD</option>
              <option value="INR">INR</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Hourly rate</label>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={clientRate}
              onChange={(e) => setClientRate(e.target.value)}
              className="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-700">Contract note</label>
            <input
              type="text"
              value={clientNote}
              onChange={(e) => setClientNote(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white"
          >
            Add Client
          </button>
        </form>
      </div>

      {/* Unbilled work */}
      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-600">Unbilled Work</h2>

        <div className="mb-3 divide-y divide-slate-100">
          {workLogs.length === 0 && <p className="py-4 text-sm text-slate-500">No unbilled work.</p>}
          {workLogs.map((log) => {
            const client = clientById.get(log.clientId);
            return (
              <label key={log.id} className="flex items-center gap-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedLogIds.has(log.id)}
                  onChange={() => toggleLogSelection(log.id)}
                />
                <span className="flex-1">
                  <span className="font-medium text-slate-800">{client?.name ?? "Unknown client"}</span>{" "}
                  <span className="text-slate-500">
                    {log.date} · {log.billableHours}h billable{log.description ? ` · ${log.description}` : ""}
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        <button
          type="button"
          disabled={!canIssueInvoice}
          onClick={() => setShowInvoiceForm(true)}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
        >
          Issue Invoice ({selectedLogs.length} selected)
        </button>

        {showInvoiceForm && canIssueInvoice && (
          <form onSubmit={handleIssueInvoice} className="mt-3 flex flex-wrap items-end gap-2 rounded-md bg-slate-50 p-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Fees ({clientById.get(selectedLogs[0].clientId)?.currency})</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={invoiceFees}
                onChange={(e) => setInvoiceFees(e.target.value)}
                className="w-28 rounded-md border border-slate-300 px-2 py-1 text-sm"
              />
            </div>
            {clientById.get(selectedLogs[0].clientId)?.currency === "USD" && (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Exchange rate to INR</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={invoiceRate}
                  onChange={(e) => setInvoiceRate(e.target.value)}
                  className="w-28 rounded-md border border-slate-300 px-2 py-1 text-sm"
                />
              </div>
            )}
            <button type="submit" className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">
              Confirm Invoice
            </button>
            <button
              type="button"
              onClick={() => setShowInvoiceForm(false)}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
          </form>
        )}
      </div>

      {/* Invoices */}
      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-600">Invoices</h2>
        <div className="divide-y divide-slate-100">
          {invoices.length === 0 && <p className="py-4 text-sm text-slate-500">No invoices yet.</p>}
          {invoices.map((invoice) => {
            const client = clientById.get(invoice.clientId);
            return (
              <div key={invoice.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="font-medium text-slate-800">
                    {client?.name ?? "Unknown client"} · {formatMinor(invoice.grossAmountMinor, invoice.currency)}
                  </p>
                  <p className="text-xs text-slate-400">
                    Issued {invoice.issueDate} · {invoice.hours}h · Net {formatPaiseAsInr(invoice.netInrPaise)}
                    {invoice.status === "paid" ? ` · Paid ${invoice.paidDate}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      invoice.status === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {invoice.status}
                  </span>
                  {invoice.status === "issued" && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleMarkPaid(invoice)}
                        className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                      >
                        Mark Paid
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteInvoice(invoice.id)}
                        className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lead expenses */}
      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-600">Lead Expenses</h2>

        <div className="mb-4 divide-y divide-slate-100">
          {leadExpenses.length === 0 && <p className="py-4 text-sm text-slate-500">No lead expenses yet.</p>}
          {leadExpenses.map((expense) => (
            <div key={expense.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <p className="text-slate-800">
                  {expense.date} · {LEAD_EXPENSE_CATEGORIES.find((c) => c.value === expense.category)?.label}
                </p>
                {expense.description && <p className="text-xs text-slate-400">{expense.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800">{formatPaiseAsInr(expense.amountPaise)}</span>
                <button
                  type="button"
                  onClick={() => handleDeleteLeadExpense(expense.id)}
                  className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleAddLeadExpense} className="flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Date</label>
            <input
              type="date"
              required
              value={leadDate}
              onChange={(e) => setLeadDate(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Amount (INR)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={leadAmount}
              onChange={(e) => setLeadAmount(e.target.value)}
              className="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Category</label>
            <select
              value={leadCategory}
              onChange={(e) => setLeadCategory(e.target.value as LeadExpenseCategory)}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              {LEAD_EXPENSE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-700">Description</label>
            <input
              type="text"
              value={leadDescription}
              onChange={(e) => setLeadDescription(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <button type="submit" className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">
            Add
          </button>
        </form>
      </div>
    </div>
  );
}
