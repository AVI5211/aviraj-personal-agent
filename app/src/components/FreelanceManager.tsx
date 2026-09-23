"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { PeriodFilter } from "@/components/PeriodFilter";
import { formatPaiseAsInr } from "@/lib/money";
import { interpretImportRows, parseDelimitedTextAuto, type ParsedImportRow } from "@/lib/freelance-import";
import type {
  ClientApi,
  ClientCurrency,
  EpicApi,
  FreelanceSummaryResponse,
  InvoiceApi,
  LeadExpenseApi,
  LeadExpenseCategory,
  PaymentPlatform,
  Period,
  WorkLogApi,
} from "@/lib/types";

const NEW_EPIC_VALUE = "__new__";

function formatMinor(amountMinor: number, currency: ClientCurrency): string {
  if (currency === "INR") return formatPaiseAsInr(amountMinor);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amountMinor / 100);
}

const LEAD_EXPENSE_CATEGORIES: { value: LeadExpenseCategory; label: string }[] = [
  { value: "upwork_connects", label: "Upwork Connects" },
  { value: "subscription", label: "Subscription" },
  { value: "other", label: "Other" },
];

const PAYMENT_PLATFORMS: { value: PaymentPlatform; label: string }[] = [
  { value: "upwork", label: "Upwork" },
  { value: "deel", label: "Deel" },
  { value: "other", label: "Other" },
];

interface LogFormState {
  date: string;
  billable: string;
  nonBillable: string;
  description: string;
  notes: string;
  epicId: string; // "" = none, NEW_EPIC_VALUE = show new-epic input, else an epic id
  newEpicName: string;
  paymentReceived: boolean;
  paymentPlatform: PaymentPlatform;
  taxPercent: string;
}

function emptyLogForm(defaultEpicId: string): LogFormState {
  return {
    date: "",
    billable: "",
    nonBillable: "0",
    description: "",
    notes: "",
    epicId: defaultEpicId,
    newEpicName: "",
    paymentReceived: false,
    paymentPlatform: "upwork",
    taxPercent: "0",
  };
}

export function FreelanceManager() {
  // Freelance payments/invoices are often backdated or irregular (unlike salary/shop's
  // steady monthly cadence), so default to showing everything rather than "this month"
  // silently hiding real totals behind a date filter the user didn't think to change.
  const [period, setPeriod] = useState<Period>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [summary, setSummary] = useState<FreelanceSummaryResponse | null>(null);
  const [clients, setClients] = useState<ClientApi[]>([]);
  const [epics, setEpics] = useState<EpicApi[]>([]);
  const [workLogs, setWorkLogs] = useState<WorkLogApi[]>([]);
  const [invoices, setInvoices] = useState<InvoiceApi[]>([]);
  const [leadExpenses, setLeadExpenses] = useState<LeadExpenseApi[]>([]);

  const [usdInrRate, setUsdInrRate] = useState("83");
  const [rateSaving, setRateSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // New client form
  const [clientName, setClientName] = useState("");
  const [clientCurrency, setClientCurrency] = useState<ClientCurrency>("USD");
  const [clientRate, setClientRate] = useState("");
  const [clientNote, setClientNote] = useState("");

  // Work log inline form state, keyed by clientId
  const [logForms, setLogForms] = useState<Record<string, LogFormState>>({});

  // Client cards collapse by default so a long client list doesn't dominate the page;
  // the most recently added client (the currently active one, e.g. a new payment
  // platform) starts expanded, older ones start collapsed.
  const [collapsedClientIds, setCollapsedClientIds] = useState<Set<string>>(new Set());
  const [collapseDefaultsApplied, setCollapseDefaultsApplied] = useState(false);

  // Invoice selection (batch-invoicing multiple unbilled entries at once)
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [invoicePlatform, setInvoicePlatform] = useState<PaymentPlatform>("upwork");
  const [invoiceFees, setInvoiceFees] = useState("0");

  // Quick invoice: pay a flat number of hours per client regardless of which
  // epics/entries they come from, keyed by clientId.
  const [quickInvoiceForms, setQuickInvoiceForms] = useState<
    Record<string, { hours: string; platform: PaymentPlatform; feesMinor: string; taxPercent: string }>
  >({});
  const [quickInvoiceSubmitting, setQuickInvoiceSubmitting] = useState<string | null>(null);

  // Bulk timesheet import: paste a TSV/CSV block (e.g. copied out of Excel) or upload a
  // file, preview what's new vs. already recorded, then confirm. Only one client's
  // import panel is open at a time.
  const [importClientId, setImportClientId] = useState<string | null>(null);
  const [importText, setImportText] = useState("");
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [importParsing, setImportParsing] = useState(false);
  const [importSubmitting, setImportSubmitting] = useState(false);
  const [importRows, setImportRows] = useState<ParsedImportRow[]>([]);
  const [importPreview, setImportPreview] = useState<(ParsedImportRow & { status: string })[] | null>(null);
  const [importResult, setImportResult] = useState<{ workLogsCreated: number; epicsCreated: number } | null>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  // Lead expense form
  const [leadDate, setLeadDate] = useState("");
  const [leadAmount, setLeadAmount] = useState("");
  const [leadCategory, setLeadCategory] = useState<LeadExpenseCategory>("upwork_connects");
  const [leadDescription, setLeadDescription] = useState("");

  const canQuery = period !== "custom" || Boolean(customFrom && customTo);

  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const epicById = useMemo(() => new Map(epics.map((e) => [e.id, e])), [epics]);

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

  const fetchEpics = useCallback(async () => {
    const response = await fetch("/api/freelance/epics");
    if (response.ok) {
      const data = await response.json();
      setEpics(data.epics);
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

  const fetchExchangeRate = useCallback(async () => {
    const response = await fetch("/api/freelance/exchange-rate");
    if (response.ok) {
      const data = await response.json();
      setUsdInrRate(String(data.rate));
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    fetchClients();
    fetchEpics();
    fetchWorkLogs();
    fetchInvoices();
    fetchLeadExpenses();
    fetchExchangeRate();
  }, [fetchClients, fetchEpics, fetchWorkLogs, fetchInvoices, fetchLeadExpenses, fetchExchangeRate]);

  useEffect(() => {
    if (collapseDefaultsApplied || clients.length === 0) return;
    const mostRecent = [...clients].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
    setCollapsedClientIds(new Set(clients.filter((c) => c.id !== mostRecent.id).map((c) => c.id)));
    setCollapseDefaultsApplied(true);
  }, [clients, collapseDefaultsApplied]);

  function toggleClientCollapse(id: string) {
    setCollapsedClientIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function refreshAfterMutation() {
    fetchSummary();
    fetchWorkLogs();
    fetchInvoices();
    fetchEpics();
  }

  async function handleSaveRate(event: FormEvent) {
    event.preventDefault();
    const rate = Number(usdInrRate);
    if (!Number.isFinite(rate) || rate <= 0) {
      setError("Enter a valid USD → INR rate");
      return;
    }
    setRateSaving(true);
    await fetch("/api/freelance/exchange-rate", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rate }),
    });
    setRateSaving(false);
    fetchSummary();
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

  // Default a client's log form to the most recently used epic for that client.
  function defaultEpicFor(clientId: string): string {
    const clientEpics = epics.filter((e) => e.clientId === clientId);
    return clientEpics[0]?.id ?? "";
  }

  function getLogForm(clientId: string): LogFormState {
    return logForms[clientId] ?? emptyLogForm(defaultEpicFor(clientId));
  }

  function setLogForm(clientId: string, patch: Partial<LogFormState>) {
    setLogForms((prev) => ({ ...prev, [clientId]: { ...getLogForm(clientId), ...patch } }));
  }

  function estimatedPaymentPaise(client: ClientApi, billableHours: number): number {
    const amountMinor = billableHours * client.hourlyRateMinor;
    if (client.currency === "INR") return amountMinor;
    const rate = Number(usdInrRate) || 0;
    return Math.round(amountMinor * rate);
  }

  function clientPendingStats(clientId: string) {
    const logs = workLogs.filter((log) => log.clientId === clientId);
    const hours = logs.reduce((sum, log) => sum + log.billableHours, 0);
    const client = clientById.get(clientId);
    const paise = client ? estimatedPaymentPaise(client, hours) : 0;
    return { hours, paise };
  }

  async function handleAddWorkLog(client: ClientApi, event: FormEvent) {
    event.preventDefault();
    setError(null);
    const form = getLogForm(client.id);
    const billable = Number(form.billable);
    const nonBillable = Number(form.nonBillable || "0");
    const taxPercent = Number(form.taxPercent || "0");

    if (!form.date || !Number.isFinite(billable) || billable < 0) {
      setError("Enter a valid date and billable hours");
      return;
    }
    if (form.paymentReceived && (!Number.isFinite(taxPercent) || taxPercent < 0 || taxPercent > 100)) {
      setError("Enter a valid tax percentage (0-100)");
      return;
    }

    // Resolve/create the epic first, if a new one was requested.
    let epicId: string | null = form.epicId && form.epicId !== NEW_EPIC_VALUE ? form.epicId : null;
    if (form.epicId === NEW_EPIC_VALUE) {
      if (!form.newEpicName.trim()) {
        setError("Enter a name for the new epic");
        return;
      }
      const epicResponse = await fetch("/api/freelance/epics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: client.id, name: form.newEpicName }),
      });
      if (!epicResponse.ok) {
        setError("Could not create epic");
        return;
      }
      const epic = await epicResponse.json();
      epicId = epic.id;
    }

    const logResponse = await fetch("/api/freelance/work-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: client.id,
        epicId,
        date: form.date,
        billableHours: billable,
        nonBillableHours: nonBillable,
        description: form.description,
        notes: form.notes,
      }),
    });
    if (!logResponse.ok) {
      setError("Could not log work");
      return;
    }
    const log = await logResponse.json();

    if (form.paymentReceived) {
      const exchangeRateToInr = client.currency === "INR" ? 1 : Number(usdInrRate) || 1;
      const invoiceResponse = await fetch("/api/freelance/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: client.id,
          workLogIds: [log.id],
          paymentPlatform: form.paymentPlatform,
          feesMinor: 0,
          exchangeRateToInr,
        }),
      });
      if (!invoiceResponse.ok) {
        setError("Work was logged, but the payment could not be recorded");
        setLogForms((prev) => ({ ...prev, [client.id]: emptyLogForm(defaultEpicFor(client.id)) }));
        refreshAfterMutation();
        return;
      }
      const invoice = await invoiceResponse.json();
      const taxPaidPaise = Math.round(invoice.netInrPaise * (taxPercent / 100));

      await fetch(`/api/freelance/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "paid",
          netInrPaise: invoice.netInrPaise,
          taxPaidPaise,
          paidDate: form.date,
        }),
      });
    }

    setLogForms((prev) => ({ ...prev, [client.id]: emptyLogForm(defaultEpicFor(client.id)) }));
    refreshAfterMutation();
  }

  function toggleLogSelection(id: string) {
    setSelectedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleClientSelection(logs: WorkLogApi[], select: boolean) {
    setSelectedLogIds((prev) => {
      const next = new Set(prev);
      for (const log of logs) {
        if (select) next.add(log.id);
        else next.delete(log.id);
      }
      return next;
    });
  }

  const unbilledByClient = useMemo(() => {
    const groups = new Map<string, WorkLogApi[]>();
    for (const log of workLogs) {
      const list = groups.get(log.clientId) ?? [];
      list.push(log);
      groups.set(log.clientId, list);
    }
    return Array.from(groups.entries());
  }, [workLogs]);

  const selectedLogs = workLogs.filter((log) => selectedLogIds.has(log.id));
  const selectedClientIds = new Set(selectedLogs.map((log) => log.clientId));
  const canIssueInvoice = selectedLogs.length > 0 && selectedClientIds.size === 1;

  function getQuickInvoiceForm(clientId: string) {
    return quickInvoiceForms[clientId] ?? { hours: "", platform: "upwork" as PaymentPlatform, feesMinor: "0", taxPercent: "0" };
  }

  function setQuickInvoiceForm(clientId: string, patch: Partial<ReturnType<typeof getQuickInvoiceForm>>) {
    setQuickInvoiceForms((prev) => ({ ...prev, [clientId]: { ...getQuickInvoiceForm(clientId), ...patch } }));
  }

  async function handleQuickInvoice(client: ClientApi, event: FormEvent) {
    event.preventDefault();
    setError(null);
    const form = getQuickInvoiceForm(client.id);
    const hours = Number(form.hours);
    const fees = Number(form.feesMinor || "0");
    const taxPercent = Number(form.taxPercent || "0");

    if (!Number.isFinite(hours) || hours <= 0) {
      setError("Enter a valid number of hours to invoice");
      return;
    }
    if (!Number.isFinite(fees) || fees < 0) {
      setError("Enter a valid fee amount");
      return;
    }
    if (!Number.isFinite(taxPercent) || taxPercent < 0 || taxPercent > 100) {
      setError("Enter a valid tax percentage (0-100)");
      return;
    }

    setQuickInvoiceSubmitting(client.id);
    const exchangeRateToInr = client.currency === "INR" ? 1 : Number(usdInrRate) || 1;
    const response = await fetch("/api/freelance/quick-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: client.id,
        hours,
        paymentPlatform: form.platform,
        feesMinor: Math.round(fees * 100),
        exchangeRateToInr,
        taxPercent,
      }),
    });
    setQuickInvoiceSubmitting(null);

    if (!response.ok) {
      setError("Could not create the quick invoice");
      return;
    }
    const data = await response.json();
    if (data.capped) {
      setError(
        `Only ${data.invoicedHours}h of unbilled work was available for this client — invoiced that instead of ${data.requestedHours}h.`
      );
    }
    setQuickInvoiceForms((prev) => ({ ...prev, [client.id]: { hours: "", platform: form.platform, feesMinor: "0", taxPercent: "0" } }));
    refreshAfterMutation();
  }

  function openImportPanel(clientId: string) {
    setImportClientId(clientId);
    setImportText("");
    setImportFileName(null);
    setImportRows([]);
    setImportPreview(null);
    setImportResult(null);
    setError(null);
  }

  function closeImportPanel() {
    setImportClientId(null);
    setImportText("");
    setImportFileName(null);
    setImportRows([]);
    setImportPreview(null);
    setImportResult(null);
    if (importFileInputRef.current) importFileInputRef.current.value = "";
  }

  async function handleImportFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    setImportPreview(null);
    setImportResult(null);
    setError(null);

    const isExcel = /\.(xlsx|xls)$/i.test(file.name);
    if (isExcel) {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: unknown[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: false, defval: "" });
      const asStrings = rows.map((row) => row.map((cell) => String(cell ?? "")));
      const parsedRows = interpretImportRows(asStrings);
      setImportRows(parsedRows);
      setImportText("");
      if (importClientId) await requestImportPreview(importClientId, parsedRows);
    } else {
      const text = await file.text();
      setImportText(text);
      const parsedRows = interpretImportRows(parseDelimitedTextAuto(text));
      setImportRows(parsedRows);
      if (importClientId) await requestImportPreview(importClientId, parsedRows);
    }
  }

  async function handleParsePastedText() {
    setError(null);
    if (!importText.trim()) {
      setError("Paste some timesheet data first");
      return;
    }
    const parsedRows = interpretImportRows(parseDelimitedTextAuto(importText));
    setImportRows(parsedRows);
    if (importClientId) await requestImportPreview(importClientId, parsedRows);
  }

  async function requestImportPreview(clientId: string, rows: ParsedImportRow[]) {
    if (rows.length === 0) {
      setError("No recognizable rows found — make sure it includes an EPIC header row above the data");
      return;
    }
    const datedRows = rows.filter((r): r is ParsedImportRow & { date: string } => r.date !== null);
    if (datedRows.length === 0) {
      setError("No rows had a recognizable date — fix the dates in the source and re-paste");
      return;
    }

    setImportParsing(true);
    setError(null);
    const response = await fetch("/api/freelance/work-logs/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        dryRun: true,
        rows: datedRows.map((r) => ({ epicName: r.epicName, description: r.description, hours: r.hours, date: r.date, notes: r.notes })),
      }),
    });
    setImportParsing(false);
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error && typeof data.error === "string" ? data.error : "Could not preview the import");
      return;
    }
    const data = await response.json();
    const serverRows: (ParsedImportRow & { status: string })[] = data.rows;
    let cursor = 0;
    const merged = rows.map((row) =>
      row.date === null ? { ...row, status: "needs_date" } : serverRows[cursor++]
    );
    setImportPreview(merged);
  }

  async function handleConfirmImport(clientId: string) {
    const validRows = importRows.filter((r) => r.date !== null);
    setImportSubmitting(true);
    setError(null);
    const response = await fetch("/api/freelance/work-logs/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        dryRun: false,
        rows: validRows.map((r) => ({ epicName: r.epicName, description: r.description, hours: r.hours, date: r.date, notes: r.notes })),
      }),
    });
    setImportSubmitting(false);
    if (!response.ok) {
      setError("Could not complete the import");
      return;
    }
    const data = await response.json();
    setImportResult({ workLogsCreated: data.workLogsCreated, epicsCreated: data.epicsCreated });
    setImportPreview(null);
    refreshAfterMutation();
  }

  async function handleIssueInvoice(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const fees = Number(invoiceFees);
    if (!Number.isFinite(fees) || fees < 0) {
      setError("Enter a valid fee amount");
      return;
    }
    const clientId = selectedLogs[0]?.clientId;
    if (!clientId) return;
    const client = clientById.get(clientId);
    const feesMinor = Math.round(fees * 100);
    const exchangeRateToInr = client?.currency === "INR" ? 1 : Number(usdInrRate) || 1;

    const response = await fetch("/api/freelance/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        workLogIds: Array.from(selectedLogIds),
        paymentPlatform: invoicePlatform,
        feesMinor,
        exchangeRateToInr,
      }),
    });
    if (!response.ok) {
      setError("Could not issue invoice");
      return;
    }
    setSelectedLogIds(new Set());
    setShowInvoiceForm(false);
    setInvoicePlatform("upwork");
    setInvoiceFees("0");
    refreshAfterMutation();
  }

  async function handleMarkPaid(invoice: InvoiceApi) {
    const netInput = window.prompt("Net INR received (rupees)", "");
    if (netInput === null) return;
    const net = Number(netInput);
    if (!Number.isFinite(net) || net < 0) return;
    const taxInput = window.prompt("Tax paid on this invoice (rupees, 0 if none)", "0");
    if (taxInput === null) return;
    const tax = Number(taxInput);
    if (!Number.isFinite(tax) || tax < 0) return;
    const paidDate = window.prompt("Paid date (YYYY-MM-DD)", new Date().toISOString().slice(0, 10));
    if (!paidDate) return;

    const response = await fetch(`/api/freelance/invoices/${invoice.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "paid",
        netInrPaise: Math.round(net * 100),
        taxPaidPaise: Math.round(tax * 100),
        paidDate,
      }),
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

      {error && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <PeriodFilter
          period={period}
          customFrom={customFrom}
          customTo={customTo}
          onPeriodChange={setPeriod}
          onCustomFromChange={setCustomFrom}
          onCustomToChange={setCustomTo}
        />
        <form onSubmit={handleSaveRate} className="flex items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">USD → INR rate</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={usdInrRate}
              onChange={(e) => setUsdInrRate(e.target.value)}
              className="w-full sm:w-24 rounded-md border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={rateSaving}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Save Rate
          </button>
        </form>
      </div>

      {/* Summary cards */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Total Received</p>
          <p className="mt-1 text-lg font-semibold text-emerald-600">
            {formatPaiseAsInr(summary?.receivedPaise ?? 0)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Total In-Hand Received</p>
          <p className="mt-1 text-lg font-semibold text-emerald-600">
            {formatPaiseAsInr(summary?.inHandReceivedPaise ?? 0)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Tax Paid</p>
          <p className="mt-1 text-lg font-semibold text-red-600">{formatPaiseAsInr(summary?.taxPaidPaise ?? 0)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Service Fees Paid</p>
          <p className="mt-1 text-lg font-semibold text-red-600">{formatPaiseAsInr(summary?.feesPaidPaise ?? 0)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Pending Invoices</p>
          <p className="mt-1 text-lg font-semibold text-amber-600">{formatPaiseAsInr(summary?.pendingPaise ?? 0)}</p>
          <p className="text-xs text-slate-400">Issued, awaiting payment</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Unbilled Work</p>
          <p className="mt-1 text-lg font-semibold text-slate-800">
            {summary?.unbilledHours ?? 0}h · ~{formatPaiseAsInr(summary?.unbilledAmountEstimatePaise ?? 0)}
          </p>
          <p className="text-xs text-slate-400">Logged, not yet invoiced</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Lead Expenses</p>
          <p className="mt-1 text-lg font-semibold text-slate-800">
            {formatPaiseAsInr(summary?.leadExpensesPaise ?? 0)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:col-span-2">
          <p className="mb-1 text-xs font-medium text-slate-500">Received by Platform</p>
          <div className="flex flex-wrap gap-3">
            {PAYMENT_PLATFORMS.map((p) => (
              <span key={p.value} className="text-sm text-slate-700">
                {p.label}: <span className="font-semibold">{formatPaiseAsInr(summary?.byPlatform[p.value] ?? 0)}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Clients */}
      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-600">Clients</h2>

        <div className="mb-4 divide-y divide-slate-100">
          {clients.length === 0 && <p className="py-4 text-sm text-slate-500">No clients yet — add one below.</p>}
          {clients.map((client) => {
            const logForm = getLogForm(client.id);
            const clientEpics = epics.filter((e) => e.clientId === client.id);
            const pending = clientPendingStats(client.id);
            const billable = Number(logForm.billable);
            const liveEstimate =
              Number.isFinite(billable) && billable > 0 ? estimatedPaymentPaise(client, billable) : 0;
            const isCollapsed = collapsedClientIds.has(client.id);

            return (
              <div key={client.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => toggleClientCollapse(client.id)}
                    className="flex min-w-0 flex-1 items-start gap-2 text-left"
                  >
                    <span className="mt-1 text-slate-400">{isCollapsed ? "▸" : "▾"}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800">{client.name}</span>
                      <span className="block text-xs text-slate-400">
                        {client.currency} · {formatMinor(client.hourlyRateMinor, client.currency)}/hr
                      </span>
                      {!isCollapsed && client.contractNote && (
                        <span className="block text-xs text-slate-400">{client.contractNote}</span>
                      )}
                      <span className="block text-xs font-medium text-amber-600">
                        Pending: {pending.hours}h · ~{formatPaiseAsInr(pending.paise)}
                      </span>
                    </span>
                  </button>
                  {!isCollapsed && (
                    <button
                      type="button"
                      onClick={() => (importClientId === client.id ? closeImportPanel() : openImportPanel(client.id))}
                      className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                    >
                      {importClientId === client.id ? "Close Import" : "Import Timesheet"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteClient(client.id)}
                    className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>

                {!isCollapsed && importClientId === client.id && (
                  <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-3">
                    {!importResult && (
                      <>
                        <p className="mb-2 text-xs text-slate-600">
                          Paste an EPIC timesheet block (as copied from a spreadsheet) or upload a file. Rows are
                          matched against what&apos;s already recorded per epic by date, so re-pasting the same
                          sheet only ever adds what&apos;s new.
                        </p>
                        <textarea
                          value={importText}
                          onChange={(e) => setImportText(e.target.value)}
                          placeholder="Paste tab-separated timesheet rows here…"
                          rows={4}
                          className="mb-2 w-full rounded-md border border-slate-300 px-2 py-1.5 font-mono text-xs"
                        />
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={handleParsePastedText}
                            disabled={importParsing}
                            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                          >
                            {importParsing ? "Parsing…" : "Parse & Preview"}
                          </button>
                          <span className="text-xs text-slate-400">or</span>
                          <input
                            ref={importFileInputRef}
                            type="file"
                            accept=".csv,.tsv,.txt,.xlsx,.xls"
                            onChange={handleImportFileChange}
                            className="text-xs"
                          />
                          {importFileName && <span className="text-xs text-slate-500">{importFileName}</span>}
                        </div>

                        {importPreview && (
                          <>
                            <div className="mb-2 flex flex-wrap items-center gap-3 text-xs">
                              <span className="font-medium text-emerald-700">
                                {importPreview.filter((r) => r.status === "new").length} new
                              </span>
                              <span className="text-slate-500">
                                {importPreview.filter((r) => r.status === "already_recorded").length} already recorded
                              </span>
                              {importPreview.some((r) => r.status === "needs_date") && (
                                <span className="font-medium text-red-600">
                                  {importPreview.filter((r) => r.status === "needs_date").length} need a fixable date
                                  (excluded)
                                </span>
                              )}
                            </div>
                            <div className="mb-2 max-h-64 overflow-y-auto rounded-md border border-slate-200 bg-white">
                              <table className="w-full text-left text-xs">
                                <thead className="sticky top-0 bg-slate-100 text-slate-500">
                                  <tr>
                                    <th className="px-2 py-1">Status</th>
                                    <th className="px-2 py-1">Epic</th>
                                    <th className="px-2 py-1">Date</th>
                                    <th className="px-2 py-1 text-right">Hours</th>
                                    <th className="px-2 py-1">Task</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {importPreview.map((row, i) => (
                                    <tr key={i} className={row.status !== "new" ? "text-slate-400" : undefined}>
                                      <td className="whitespace-nowrap px-2 py-1">
                                        {row.status === "new" && (
                                          <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-emerald-700">
                                            New
                                          </span>
                                        )}
                                        {row.status === "already_recorded" && (
                                          <span className="rounded-full bg-slate-100 px-1.5 py-0.5">Skip</span>
                                        )}
                                        {row.status === "needs_date" && (
                                          <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-red-700">
                                            Bad date
                                          </span>
                                        )}
                                      </td>
                                      <td className="whitespace-nowrap px-2 py-1">{row.epicName}</td>
                                      <td className="whitespace-nowrap px-2 py-1">{row.date ?? row.dateRaw}</td>
                                      <td className="whitespace-nowrap px-2 py-1 text-right">{row.hours}h</td>
                                      <td className="max-w-xs truncate px-2 py-1" title={row.description}>
                                        {row.description}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleConfirmImport(client.id)}
                                disabled={
                                  importSubmitting || importPreview.filter((r) => r.status === "new").length === 0
                                }
                                className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                              >
                                {importSubmitting
                                  ? "Importing…"
                                  : `Confirm Import (${importPreview.filter((r) => r.status === "new").length})`}
                              </button>
                              <button
                                type="button"
                                onClick={closeImportPanel}
                                className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                              >
                                Cancel
                              </button>
                            </div>
                          </>
                        )}
                      </>
                    )}

                    {importResult && (
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-emerald-700">
                          Imported {importResult.workLogsCreated} new work log
                          {importResult.workLogsCreated === 1 ? "" : "s"}
                          {importResult.epicsCreated > 0
                            ? ` and created ${importResult.epicsCreated} new epic${importResult.epicsCreated === 1 ? "" : "s"}`
                            : ""}
                          .
                        </p>
                        <button
                          type="button"
                          onClick={closeImportPanel}
                          className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                        >
                          Close
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {!isCollapsed && (
                <form
                  onSubmit={(e) => handleAddWorkLog(client, e)}
                  className="mt-2 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end rounded-md bg-slate-50 p-2"
                >
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">Epic</label>
                    <select
                      value={logForm.epicId}
                      onChange={(e) => setLogForm(client.id, { epicId: e.target.value })}
                      className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                    >
                      <option value="">No epic</option>
                      {clientEpics.map((epic) => (
                        <option key={epic.id} value={epic.id}>
                          {epic.name}
                        </option>
                      ))}
                      <option value={NEW_EPIC_VALUE}>+ New epic...</option>
                    </select>
                  </div>
                  {logForm.epicId === NEW_EPIC_VALUE && (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-700">New epic name</label>
                      <input
                        type="text"
                        value={logForm.newEpicName}
                        onChange={(e) => setLogForm(client.id, { newEpicName: e.target.value })}
                        className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                      />
                    </div>
                  )}
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
                    <label className="mb-1 block text-xs font-medium text-slate-700">Hours worked</label>
                    <input
                      type="number"
                      min="0"
                      step="0.25"
                      required
                      value={logForm.billable}
                      onChange={(e) => setLogForm(client.id, { billable: e.target.value })}
                      className="w-full sm:w-24 rounded-md border border-slate-300 px-2 py-1 text-sm"
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
                      className="w-full sm:w-24 rounded-md border border-slate-300 px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="col-span-2 sm:flex-1">
                    <label className="mb-1 block text-xs font-medium text-slate-700">Completed tasks</label>
                    <input
                      type="text"
                      value={logForm.description}
                      onChange={(e) => setLogForm(client.id, { description: e.target.value })}
                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="col-span-2 sm:flex-1">
                    <label className="mb-1 block text-xs font-medium text-slate-700">Notes</label>
                    <input
                      type="text"
                      value={logForm.notes}
                      onChange={(e) => setLogForm(client.id, { notes: e.target.value })}
                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                    />
                  </div>

                  <div className="flex items-center gap-1 pb-1">
                    <input
                      id={`paid-${client.id}`}
                      type="checkbox"
                      checked={logForm.paymentReceived}
                      onChange={(e) => setLogForm(client.id, { paymentReceived: e.target.checked })}
                    />
                    <label htmlFor={`paid-${client.id}`} className="text-xs text-slate-600">
                      Payment received
                    </label>
                  </div>
                  {logForm.paymentReceived && (
                    <>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-700">Platform</label>
                        <select
                          value={logForm.paymentPlatform}
                          onChange={(e) =>
                            setLogForm(client.id, { paymentPlatform: e.target.value as PaymentPlatform })
                          }
                          className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                        >
                          {PAYMENT_PLATFORMS.map((p) => (
                            <option key={p.value} value={p.value}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-700">Tax %</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={logForm.taxPercent}
                          onChange={(e) => setLogForm(client.id, { taxPercent: e.target.value })}
                          className="w-full sm:w-20 rounded-md border border-slate-300 px-2 py-1 text-sm"
                        />
                      </div>
                    </>
                  )}

                  <div className="col-span-2 flex items-center justify-between gap-2 sm:flex-1">
                    <span className="text-xs font-medium text-slate-500">
                      Est. payment: <span className="text-slate-800">{formatPaiseAsInr(liveEstimate)}</span>
                    </span>
                    <button type="submit" className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">
                      Log Work
                    </button>
                  </div>
                </form>
                )}
              </div>
            );
          })}
        </div>

        <form onSubmit={handleAddClient} className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end">
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
              className="w-full sm:w-28 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div className="col-span-2 sm:flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-700">Contract note</label>
            <input
              type="text"
              value={clientNote}
              onChange={(e) => setClientNote(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <button type="submit" className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">
            Add Client
          </button>
        </form>
      </div>

      {/* Unbilled work */}
      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-600">Unbilled Work (batch invoicing)</h2>

        {workLogs.length === 0 && <p className="py-4 text-sm text-slate-500">No unbilled work.</p>}

        {unbilledByClient.map(([clientId, logs]) => {
          const client = clientById.get(clientId);
          const allSelected = logs.every((log) => selectedLogIds.has(log.id));
          const someSelected = logs.some((log) => selectedLogIds.has(log.id));
          const quickForm = getQuickInvoiceForm(clientId);
          const totalHoursForClient = logs.reduce((s, l) => s + l.billableHours, 0);
          return (
            <div key={clientId} className="mb-4 overflow-hidden rounded-lg border border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-3 py-2">
                <span className="text-sm font-semibold text-slate-700">{client?.name ?? "Unknown client"}</span>
                <span className="text-xs text-slate-500">
                  {totalHoursForClient}h across {logs.length} entries
                </span>
              </div>

              {client && (
                <form
                  onSubmit={(e) => handleQuickInvoice(client, e)}
                  className="flex flex-wrap items-end gap-2 border-b border-slate-200 bg-amber-50 px-3 py-2"
                >
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">Quick invoice hours</label>
                    <input
                      type="number"
                      min="0"
                      step="0.25"
                      max={totalHoursForClient}
                      required
                      value={quickForm.hours}
                      onChange={(e) => setQuickInvoiceForm(clientId, { hours: e.target.value })}
                      placeholder="e.g. 100"
                      className="w-28 rounded-md border border-slate-300 px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">Platform</label>
                    <select
                      value={quickForm.platform}
                      onChange={(e) => setQuickInvoiceForm(clientId, { platform: e.target.value as PaymentPlatform })}
                      className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                    >
                      {PAYMENT_PLATFORMS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      Fee ({client.currency})
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={quickForm.feesMinor}
                      onChange={(e) => setQuickInvoiceForm(clientId, { feesMinor: e.target.value })}
                      className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">Tax %</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={quickForm.taxPercent}
                      onChange={(e) => setQuickInvoiceForm(clientId, { taxPercent: e.target.value })}
                      className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={quickInvoiceSubmitting === clientId}
                    className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {quickInvoiceSubmitting === clientId ? "Invoicing..." : "Invoice & Mark Paid"}
                  </button>
                  <p className="w-full text-xs text-slate-500">
                    Takes the oldest unbilled hours first, regardless of epic. If it lands mid-entry, that entry is
                    split — the rest stays unbilled, marked &ldquo;partially billed&rdquo; in its notes.
                  </p>
                </form>
              )}

              <div className="max-h-96 overflow-y-auto overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-white text-xs uppercase tracking-wide text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th className="w-9 px-3 py-2">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = someSelected && !allSelected;
                          }}
                          onChange={() => toggleClientSelection(logs, !allSelected)}
                        />
                      </th>
                      <th className="whitespace-nowrap px-3 py-2">Epic</th>
                      <th className="whitespace-nowrap px-3 py-2">Date</th>
                      <th className="whitespace-nowrap px-3 py-2 text-right">Hours</th>
                      <th className="px-3 py-2">Task</th>
                      <th className="px-3 py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {logs.map((log) => {
                      const epic = log.epicId ? epicById.get(log.epicId) : null;
                      const isSelected = selectedLogIds.has(log.id);
                      return (
                        <tr key={log.id} className={isSelected ? "bg-slate-50" : undefined}>
                          <td className="px-3 py-2 align-top">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleLogSelection(log.id)}
                            />
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 align-top">
                            {epic ? (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                                {epic.name}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 align-top text-slate-600">{log.date}</td>
                          <td className="whitespace-nowrap px-3 py-2 align-top text-right font-medium text-slate-800">
                            {log.billableHours}h
                          </td>
                          <td className="max-w-xs px-3 py-2 align-top">
                            <span className="line-clamp-2 text-slate-700" title={log.description}>
                              {log.description || "—"}
                            </span>
                          </td>
                          <td className="max-w-[12rem] px-3 py-2 align-top">
                            <span className="line-clamp-2 text-xs text-slate-400" title={log.notes}>
                              {log.notes || "—"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

        <button
          type="button"
          disabled={!canIssueInvoice}
          onClick={() => setShowInvoiceForm(true)}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
        >
          Issue Invoice ({selectedLogs.length} selected)
        </button>

        {showInvoiceForm && canIssueInvoice && (
          <form onSubmit={handleIssueInvoice} className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end rounded-md bg-slate-50 p-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Payment platform</label>
              <select
                value={invoicePlatform}
                onChange={(e) => setInvoicePlatform(e.target.value as PaymentPlatform)}
                className="rounded-md border border-slate-300 px-2 py-1 text-sm"
              >
                {PAYMENT_PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Service fee ({clientById.get(selectedLogs[0].clientId)?.currency})
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={invoiceFees}
                onChange={(e) => setInvoiceFees(e.target.value)}
                className="w-full sm:w-28 rounded-md border border-slate-300 px-2 py-1 text-sm"
              />
            </div>
            {clientById.get(selectedLogs[0].clientId)?.currency === "USD" && (
              <p className="text-xs text-slate-500">Using saved rate: {usdInrRate} INR/USD</p>
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
              <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-800">
                    {client?.name ?? "Unknown client"} · {formatMinor(invoice.grossAmountMinor, invoice.currency)}
                  </p>
                  <p className="text-xs text-slate-400">
                    {PAYMENT_PLATFORMS.find((p) => p.value === invoice.paymentPlatform)?.label} · Issued{" "}
                    {invoice.issueDate} · {invoice.hours}h · Net {formatPaiseAsInr(invoice.netInrPaise)}
                    {invoice.status === "paid"
                      ? ` · Tax ${formatPaiseAsInr(invoice.taxPaidPaise)} · In-hand ${formatPaiseAsInr(invoice.inHandPaise)} · Paid ${invoice.paidDate}`
                      : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
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
            <div key={expense.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="text-slate-800">
                  {expense.date} · {LEAD_EXPENSE_CATEGORIES.find((c) => c.value === expense.category)?.label}
                </p>
                {expense.description && <p className="truncate text-xs text-slate-400">{expense.description}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
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

        <form onSubmit={handleAddLeadExpense} className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end">
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
              className="w-full sm:w-28 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
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
          <div className="col-span-2 sm:flex-1">
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
