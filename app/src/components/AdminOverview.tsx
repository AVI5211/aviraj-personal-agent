"use client";

import { useCallback, useEffect, useState } from "react";
import { PeriodFilter } from "@/components/PeriodFilter";
import { formatPaiseAsInr } from "@/lib/money";
import type { AdminOverviewResponse, Period } from "@/lib/types";

export function AdminOverview() {
  const [period, setPeriod] = useState<Period>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);

  const canQuery = period !== "custom" || Boolean(customFrom && customTo);

  const fetchOverview = useCallback(async () => {
    if (!canQuery) return;
    const params = new URLSearchParams({ period });
    if (period === "custom") {
      params.set("from", customFrom);
      params.set("to", customTo);
    }
    const response = await fetch(`/api/admin/overview?${params.toString()}`);
    if (response.ok) setOverview(await response.json());
  }, [period, customFrom, customTo, canQuery]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Financial Overview</h1>

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

      {overview && (
        <>
          <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Total net worth</p>
            <p className={`text-3xl font-bold ${overview.netWorth >= 0 ? "text-slate-900" : "text-red-600"}`}>
              {formatPaiseAsInr(overview.netWorth)}
            </p>
            <p className="text-xs text-slate-400">Assets minus outstanding liabilities</p>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Card label="Monthly Income" value={overview.monthlyIncome} tone="positive" />
            <Card label="Monthly Expenses" value={overview.monthlyExpense} tone="negative" />
            <Card label="Cash & Bank" value={overview.cashAndBank} />
            <Card label="Receivables" value={overview.receivables} />
          </div>

          <Section title="Income sources">
            <Row label="Perforce salary" value={overview.incomeSources.salary} />
            <Row label="Freelancing" value={overview.incomeSources.freelance} note="Coming in a future phase" />
            <Row label="Shop (drawn)" value={overview.incomeSources.shop} />
          </Section>

          <Section title="Financial position">
            <Row label="Bank & cash" value={overview.cashAndBank} />
            <Row label="Investments" value={overview.investmentsTotal} />
            <Row label="Provident fund" value={overview.pfTotal} />
            <Row label="Other assets" value={overview.otherAssetsTotal} />
            <Row label="Outstanding liabilities" value={-overview.liabilitiesTotal} negative />
          </Section>

          <Section title="Shop">
            <Row label="Net cash flow (this period)" value={overview.shopNetCashFlow} />
          </Section>

          <p className="mt-4 text-xs text-slate-400">
            Manage account balances on the Personal page, and salary entries on the Salary page.
          </p>
        </>
      )}
    </div>
  );
}

function Card({ label, value, tone }: { label: string; value: number; tone?: "positive" | "negative" }) {
  const color = tone === "positive" ? "text-emerald-600" : tone === "negative" ? "text-red-600" : "text-slate-800";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-lg font-semibold ${color}`}>{formatPaiseAsInr(value)}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-600">{title}</h2>
      <div className="divide-y divide-slate-100">{children}</div>
    </div>
  );
}

function Row({ label, value, negative, note }: { label: string; value: number; negative?: boolean; note?: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm text-slate-700">{label}</p>
        {note && <p className="text-xs text-slate-400">{note}</p>}
      </div>
      <span className={`text-sm font-semibold ${negative ? "text-red-600" : "text-slate-800"}`}>
        {formatPaiseAsInr(value)}
      </span>
    </div>
  );
}
