"use client";

import { useEffect, useState } from "react";
import type { SalarySlipApi } from "@/lib/types";
import type { ParsedSalarySlip } from "@/lib/salary-slip-parse";
import { formatPaiseAsInr } from "@/lib/money";
import { financialYearLabel, startOfFinancialYear, todayInShopTz } from "@/lib/dates";

function currentMonthValue(): string {
  return todayInShopTz().slice(0, 7);
}

function fyStartYearOf(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return m >= 4 ? y : y - 1;
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
}

// Period selector values: "all", "cy:<year>" (calendar year), or "fy:<startYear>".
function inPeriod(month: string, periodKey: string): boolean {
  if (periodKey === "all") return true;
  const [kind, value] = periodKey.split(":");
  return kind === "fy" ? fyStartYearOf(month) === Number(value) : month.startsWith(`${value}-`);
}

function paiseToInput(paise: number | null): string {
  return paise === null ? "" : String(paise / 100);
}

function inputToPaise(value: string): number | null {
  if (value.trim() === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null;
}

type ParseResponseItem = { fileName: string } & ((ParsedSalarySlip & { ok: true }) | { ok: false; error: string });

interface PendingSlip {
  key: string;
  file: File;
  month: string;
  gross: string;
  deductions: string;
  warnings: string[];
  readError: string | null;
  state: "ready" | "saving" | "saved" | "failed";
  saveError: string | null;
}

export function SalarySpikeManager() {
  const [slips, setSlips] = useState<SalarySlipApi[]>([]);
  const [periodKey, setPeriodKey] = useState(`fy:${startOfFinancialYear(todayInShopTz()).slice(0, 4)}`);
  const [viewing, setViewing] = useState<SalarySlipApi | null>(null);

  const [pending, setPending] = useState<PendingSlip[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchSlips() {
    const response = await fetch("/api/salary-slips");
    if (response.ok) setSlips((await response.json()).salarySlips);
  }

  useEffect(() => {
    fetchSlips();
  }, []);

  useEffect(() => {
    if (!viewing) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setViewing(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewing]);

  /** Reads month and totals out of the chosen PDFs; nothing is saved until "Save all". */
  async function handleFilesChosen(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (files.length === 0) return;
    setError(null);
    setReading(true);
    const body = new FormData();
    files.forEach((file) => body.append("files", file));
    const response = await fetch("/api/salary-slips/parse", { method: "POST", body });
    setReading(false);
    setFileInputKey((k) => k + 1);
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(typeof data?.error === "string" ? data.error : "Could not read the PDFs");
      return;
    }
    const { results }: { results: ParseResponseItem[] } = await response.json();
    const stamp = Date.now();
    setPending((current) => [
      ...current,
      ...results.map((result, index): PendingSlip => ({
        key: `${stamp}-${index}`,
        file: files[index],
        month: result.ok ? result.month ?? "" : "",
        gross: result.ok ? paiseToInput(result.grossPaise) : "",
        deductions: result.ok ? paiseToInput(result.deductionsPaise) : "",
        warnings: result.ok ? result.warnings : [],
        readError: result.ok ? null : result.error,
        state: "ready",
        saveError: null,
      })),
    ]);
  }

  function updatePending(key: string, patch: Partial<PendingSlip>) {
    setPending((current) => current.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }

  function problemFor(item: PendingSlip): string | null {
    if (item.readError) return item.readError;
    if (!/^\d{4}-\d{2}$/.test(item.month)) return "Pick the month";
    const gross = inputToPaise(item.gross);
    const deductions = inputToPaise(item.deductions || "0");
    if (gross === null || gross === 0) return "Enter Total Earnings";
    if (deductions === null) return "Enter a valid Total Deductions";
    if (deductions > gross) return "Deductions are more than earnings";
    if (pending.some((p) => p.key !== item.key && p.state !== "saved" && p.month === item.month)) return "Another file has the same month";
    return null;
  }

  const toSave = pending.filter((p) => p.state !== "saved" && problemFor(p) === null);

  async function handleSaveAll() {
    if (toSave.length === 0) return;
    const replacing = toSave.filter((p) => slips.some((s) => s.month === p.month));
    if (replacing.length > 0 && !window.confirm(`Replace the saved slip for ${replacing.map((p) => monthLabel(p.month)).join(", ")}?`)) {
      return;
    }
    setSaving(true);
    for (const item of toSave) {
      updatePending(item.key, { state: "saving", saveError: null });
      const body = new FormData();
      body.set("month", item.month);
      body.set("gross", item.gross);
      body.set("deductions", item.deductions || "0");
      body.set("file", item.file);
      const response = await fetch("/api/salary-slips", { method: "POST", body });
      if (response.ok) {
        updatePending(item.key, { state: "saved" });
      } else {
        const data = await response.json().catch(() => null);
        updatePending(item.key, { state: "failed", saveError: typeof data?.error === "string" ? data.error : "Upload failed" });
      }
    }
    setSaving(false);
    fetchSlips();
  }

  async function handleDelete(slip: SalarySlipApi) {
    if (!window.confirm(`Delete the slip for ${monthLabel(slip.month)}?`)) return;
    await fetch(`/api/salary-slips/${slip.month}`, { method: "DELETE" });
    setViewing(null);
    fetchSlips();
  }

  const fyStartYears = Array.from(new Set([fyStartYearOf(currentMonthValue()), ...slips.map((s) => fyStartYearOf(s.month))])).sort((a, b) => b - a);
  const calendarYears = Array.from(new Set([currentMonthValue().slice(0, 4), ...slips.map((s) => s.month.slice(0, 4))])).sort().reverse();

  const inRange = slips.filter((s) => inPeriod(s.month, periodKey));
  const totalGross = inRange.reduce((sum, s) => sum + s.grossPaise, 0);
  const totalDeductions = inRange.reduce((sum, s) => sum + s.deductionsPaise, 0);
  const totalNet = totalGross - totalDeductions;
  const averageNet = inRange.length > 0 ? Math.round(totalNet / inRange.length) : 0;

  return (
    <div>
      <div className="mb-6 flex items-center gap-2">
        <h1 className="text-xl font-semibold">Salary</h1>
        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">V2 · Salary slips</span>
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-600">Salary Overview</h2>
          <select
            value={periodKey}
            onChange={(e) => setPeriodKey(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs"
          >
            <optgroup label="Financial Year">
              {fyStartYears.map((fy) => (
                <option key={`fy:${fy}`} value={`fy:${fy}`}>
                  FY {financialYearLabel(fy)}
                </option>
              ))}
            </optgroup>
            <optgroup label="Calendar Year">
              {calendarYears.map((y) => (
                <option key={`cy:${y}`} value={`cy:${y}`}>
                  {y} (Calendar)
                </option>
              ))}
            </optgroup>
            <option value="all">All time</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <OverviewCard label="Total Earnings" value={totalGross} />
          <OverviewCard label="Total Deductions" value={totalDeductions} tone="negative" />
          <OverviewCard label="Total Net Pay" value={totalNet} tone="positive" />
          <OverviewCard label={`Avg Net / Month (${inRange.length})`} value={averageNet} />
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold text-slate-600">Upload Salary Slips</h2>
        <p className="mb-3 text-xs text-slate-400">
          Choose one or more slip PDFs. Month, Total Earnings and Total Deductions are read from each slip; check them, then save.
        </p>
        <label
          className={`flex min-h-12 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-slate-300 px-3 text-sm font-medium text-slate-600 hover:border-emerald-400 hover:bg-emerald-50 ${reading ? "pointer-events-none opacity-60" : ""}`}
        >
          {reading ? "Reading slips..." : "Choose PDFs"}
          <input
            key={fileInputKey}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="sr-only"
            onChange={(e) => handleFilesChosen(e.target.files)}
          />
        </label>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        {pending.length > 0 && (
          <div className="mt-4">
            <div className="divide-y divide-slate-100">
              {pending.map((item) => {
                const problem = item.state === "saved" ? null : problemFor(item);
                const gross = inputToPaise(item.gross) ?? 0;
                const net = gross - (inputToPaise(item.deductions || "0") ?? 0);
                const replaces = item.state !== "saved" && slips.some((s) => s.month === item.month);
                return (
                  <div key={item.key} className="py-3">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <p className="min-w-0 truncate text-xs text-slate-500" title={item.file.name}>
                        {item.file.name}
                      </p>
                      <div className="flex shrink-0 items-center gap-1">
                        {item.state === "saved" && <Badge tone="positive">Saved</Badge>}
                        {item.state === "saving" && <Badge>Saving...</Badge>}
                        {replaces && <Badge tone="warning">Replaces saved</Badge>}
                        {item.state !== "saving" && item.state !== "saved" && (
                          <button
                            type="button"
                            aria-label={`Remove ${item.file.name}`}
                            onClick={() => setPending((current) => current.filter((p) => p.key !== item.key))}
                            className="min-h-8 min-w-8 rounded-md text-slate-500 hover:bg-slate-100"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                    {!item.readError && (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <input
                          type="month"
                          aria-label="Month"
                          value={item.month}
                          disabled={item.state === "saved"}
                          onChange={(e) => updatePending(item.key, { month: e.target.value })}
                          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                        />
                        <AmountInput
                          label="Earnings"
                          value={item.gross}
                          disabled={item.state === "saved"}
                          onChange={(value) => updatePending(item.key, { gross: value })}
                        />
                        <AmountInput
                          label="Deductions"
                          value={item.deductions}
                          disabled={item.state === "saved"}
                          onChange={(value) => updatePending(item.key, { deductions: value })}
                        />
                        <p className="flex items-center text-sm font-semibold text-emerald-600">Net {formatPaiseAsInr(net)}</p>
                      </div>
                    )}
                    {item.state !== "saved" &&
                      item.warnings.map((warning) => (
                        <p key={warning} className="mt-1 text-xs text-amber-700">
                          {warning}
                        </p>
                      ))}
                    {problem && <p className="mt-1 text-xs text-red-600">{problem}</p>}
                    {item.saveError && <p className="mt-1 text-xs text-red-600">{item.saveError}</p>}
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setPending([])}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                Clear
              </button>
              <button
                type="button"
                disabled={saving || toSave.length === 0}
                onClick={handleSaveAll}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? "Saving..." : `Save all (${toSave.length})`}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold text-slate-600">Monthly Salary Slips</h2>
        <p className="mb-3 text-xs text-slate-400">Tap a month to open its slip.</p>
        <div className="divide-y divide-slate-100">
          {slips.length === 0 && <p className="py-4 text-sm text-slate-500">No salary slips uploaded yet.</p>}
          {slips.map((slip) => (
            <button
              key={slip.id}
              type="button"
              onClick={() => setViewing(slip)}
              className="flex min-h-12 w-full items-center justify-between gap-3 rounded-md px-1 py-2 text-left hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-300"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">{monthLabel(slip.month)}</p>
                <p className="text-xs text-slate-400">
                  Earnings {formatPaiseAsInr(slip.grossPaise)} · Deductions {formatPaiseAsInr(slip.deductionsPaise)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-sm font-semibold text-emerald-600">{formatPaiseAsInr(slip.netPaise)}</span>
                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">PDF</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {viewing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Salary slip for ${monthLabel(viewing.month)}`}
          className="fixed inset-0 z-50 flex flex-col bg-slate-900/70 p-0 sm:p-6"
          onClick={() => setViewing(null)}
        >
          <div
            className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden bg-white sm:rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{monthLabel(viewing.month)}</p>
                <p className="text-xs text-slate-500">Net {formatPaiseAsInr(viewing.netPaise)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <a
                  href={`/api/salary-slips/${viewing.month}`}
                  target="_blank"
                  rel="noopener"
                  className="rounded-md px-2 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                >
                  Full screen
                </a>
                <button
                  type="button"
                  onClick={() => handleDelete(viewing)}
                  className="rounded-md px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setViewing(null)}
                  className="min-h-9 min-w-9 rounded-md text-lg text-slate-600 hover:bg-slate-100"
                >
                  ×
                </button>
              </div>
            </div>
            <iframe title={`Salary slip ${viewing.month}`} src={`/api/salary-slips/${viewing.month}`} className="h-full w-full flex-1" />
          </div>
        </div>
      )}
    </div>
  );
}

function AmountInput({ label, value, disabled, onChange }: { label: string; value: string; disabled: boolean; onChange: (value: string) => void }) {
  return (
    <input
      type="number"
      min="0"
      step="0.01"
      inputMode="decimal"
      aria-label={label}
      placeholder={label}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
    />
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone?: "positive" | "warning" }) {
  const color =
    tone === "positive" ? "bg-emerald-100 text-emerald-700" : tone === "warning" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>{children}</span>;
}

function OverviewCard({ label, value, tone }: { label: string; value: number; tone?: "positive" | "negative" }) {
  const color = tone === "positive" ? "text-emerald-600" : tone === "negative" ? "text-red-600" : "text-slate-800";
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-base font-semibold ${color}`}>{formatPaiseAsInr(value)}</p>
    </div>
  );
}
