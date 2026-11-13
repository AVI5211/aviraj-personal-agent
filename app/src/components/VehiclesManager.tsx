"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PeriodFilter } from "@/components/PeriodFilter";
import { formatPaiseAsInr, paiseToRupees } from "@/lib/money";
import type {
  ChargerType,
  HomeChargeInput,
  Period,
  VehicleApi,
  VehicleLogApi,
  VehiclesDashboardResponse,
  VehicleSummary,
} from "@/lib/types";

const ALL_VIEW = "all";
const VEHICLE_COLORS = ["#059669", "#d97706", "#0284c7", "#7c3aed"];
const CHARGER_LABELS: Record<ChargerType, string> = { home: "Home", public_ac: "Public AC", dc_fast: "DC fast" };

const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm";
const labelClass = "mb-1 block text-sm font-medium text-slate-700";

function todayStr(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`)
  );
}

function formatNumber(value: number, maxDecimals = 2): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: maxDecimals }).format(value);
}

function unitFor(vehicle: VehicleApi): string {
  return vehicle.kind === "ev" ? "kWh" : "L";
}

function efficiencyUnit(vehicle: VehicleApi): string {
  return vehicle.kind === "ev" ? "km/kWh" : "km/L";
}

function needsSetup(vehicle: VehicleApi): string[] {
  const missing: string[] = [];
  if (vehicle.startOdometerKm === null) missing.push("starting odometer");
  if (vehicle.kind === "ev") {
    if (vehicle.batteryCapacityKwh === null) missing.push("battery size");
    if (vehicle.homeTariffPaisePerKwh === null) missing.push("home electricity rate");
  }
  return missing;
}

export function VehiclesManager() {
  const [vehicles, setVehicles] = useState<VehicleApi[]>([]);
  const [view, setView] = useState<string>(ALL_VIEW);
  const [viewSaving, setViewSaving] = useState(false);
  const [period, setPeriod] = useState<Period>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [dashboard, setDashboard] = useState<VehiclesDashboardResponse | null>(null);
  const [formState, setFormState] = useState<{ vehicle: VehicleApi; existing?: VehicleLogApi } | null>(null);
  const [settingsFor, setSettingsFor] = useState<VehicleApi | null>(null);
  const viewTouchStart = useRef<{ x: number; y: number } | null>(null);
  const suppressViewClick = useRef(false);

  const canQuery = period !== "custom" || Boolean(customFrom && customTo);

  const fetchVehicles = useCallback(async () => {
    const response = await fetch("/api/vehicles");
    if (!response.ok) return;
    const data: { vehicles: VehicleApi[]; view: string | null } = await response.json();
    setVehicles(data.vehicles);
    const savedView = data.view && (data.view === ALL_VIEW || data.vehicles.some((v) => v.id === data.view)) ? data.view : null;
    setView(savedView ?? data.vehicles[0]?.id ?? ALL_VIEW);
  }, []);

  const fetchDashboard = useCallback(async () => {
    if (!canQuery) return;
    const params = new URLSearchParams({ period });
    if (period === "custom") {
      params.set("from", customFrom);
      params.set("to", customTo);
    }
    const response = await fetch(`/api/vehicles/dashboard?${params.toString()}`);
    if (response.ok) {
      const data: VehiclesDashboardResponse = await response.json();
      setDashboard(data);
      setVehicles(data.vehicles);
    }
  }, [period, customFrom, customTo, canQuery]);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  async function chooseView(next: string) {
    if (next === view) return;
    const previous = view;
    setView(next);
    setViewSaving(true);
    const response = await fetch("/api/vehicles/view", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ view: next }),
    });
    setViewSaving(false);
    if (!response.ok) setView(previous);
  }

  async function handleDelete(log: VehicleLogApi) {
    if (!window.confirm("Delete this entry? This cannot be undone.")) return;
    await fetch(`/api/vehicles/logs/${log.id}`, { method: "DELETE" });
    fetchDashboard();
  }

  const selectedVehicles = view === ALL_VIEW ? vehicles : vehicles.filter((v) => v.id === view);
  const vehicleById = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);
  const summaryById = useMemo(
    () => new Map((dashboard?.summaries ?? []).map((s) => [s.vehicleId, s])),
    [dashboard]
  );
  const visibleLogs = (dashboard?.logs ?? []).filter((log) => view === ALL_VIEW || log.vehicleId === view);
  const viewOptions = [...vehicles.map((v) => ({ id: v.id, label: v.name, hint: v.kind === "ev" ? "EV" : "Petrol" })), { id: ALL_VIEW, label: "Both", hint: "Compare" }];

  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Running costs</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Vehicles</h1>
        </div>
        {vehicles.length > 0 && (
          <button
            type="button"
            onClick={() => setSettingsFor(vehicleById.get(view) ?? vehicles[0])}
            className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Settings
          </button>
        )}
      </div>

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

      {vehicles.length > 0 && (
        <div className="mb-6 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3">
          <div
            className="grid touch-pan-y gap-2"
            style={{ gridTemplateColumns: `repeat(${viewOptions.length}, minmax(0, 1fr))` }}
            role="group"
            aria-label="Vehicle"
            onTouchStart={(event) => {
              const touch = event.touches[0];
              viewTouchStart.current = { x: touch.clientX, y: touch.clientY };
            }}
            onTouchEnd={(event) => {
              const start = viewTouchStart.current;
              viewTouchStart.current = null;
              const touch = event.changedTouches[0];
              if (!start || !touch || Math.abs(touch.clientX - start.x) < 24 ||
                  Math.abs(touch.clientX - start.x) < Math.abs(touch.clientY - start.y)) return;
              const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button[data-view]")];
              const nearest = buttons.reduce<HTMLButtonElement | null>((best, button) => {
                const center = button.getBoundingClientRect().left + button.offsetWidth / 2;
                const bestCenter = best ? best.getBoundingClientRect().left + best.offsetWidth / 2 : Infinity;
                return Math.abs(center - touch.clientX) < Math.abs(bestCenter - touch.clientX) ? button : best;
              }, null);
              if (nearest?.dataset.view) {
                suppressViewClick.current = true;
                window.setTimeout(() => { suppressViewClick.current = false; }, 500);
                void chooseView(nearest.dataset.view);
              }
            }}
          >
            {viewOptions.map((option) => {
              const selected = option.id === view;
              return (
                <button
                  key={option.id}
                  data-view={option.id}
                  type="button"
                  aria-pressed={selected}
                  disabled={viewSaving}
                  onClick={() => {
                    if (suppressViewClick.current) {
                      suppressViewClick.current = false;
                      return;
                    }
                    void chooseView(option.id);
                  }}
                  className={`min-h-12 min-w-0 rounded-lg border px-2 py-2 text-center text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-wait ${selected ? "border-emerald-600 bg-emerald-600 text-white shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:border-emerald-400 hover:bg-emerald-50"}`}
                >
                  <span className="block truncate">{option.label}</span>
                  <span className={`block text-[11px] font-medium ${selected ? "text-emerald-50" : "text-slate-500"}`}>{option.hint}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedVehicles.map((vehicle) => {
        const missing = needsSetup(vehicle);
        if (missing.length === 0) return null;
        return (
          <div key={vehicle.id} className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="min-w-0 text-sm text-amber-900">
              <span className="font-semibold">Finish {vehicle.name} setup:</span> add {missing.join(", ")}.
            </p>
            <button
              type="button"
              onClick={() => setSettingsFor(vehicle)}
              className="min-h-10 rounded-md bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700"
            >
              Open settings
            </button>
          </div>
        );
      })}

      <div className="mb-6 flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white/75 p-3 shadow-sm">
        {selectedVehicles.map((vehicle) => (
          <button
            key={vehicle.id}
            type="button"
            onClick={() => setFormState({ vehicle })}
            className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm ${vehicle.kind === "ev" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-amber-600 hover:bg-amber-700"}`}
          >
            {vehicle.kind === "ev" ? "+ Add charge" : "+ Add fill-up"}
            {view === ALL_VIEW && <span className="block text-xs font-medium opacity-90">{vehicle.name}</span>}
          </button>
        ))}
      </div>

      {dashboard && view !== ALL_VIEW && selectedVehicles[0] && summaryById.get(selectedVehicles[0].id) && (
        <VehicleStats vehicle={selectedVehicles[0]} summary={summaryById.get(selectedVehicles[0].id)!} />
      )}

      {dashboard && view === ALL_VIEW && (
        <div className="mb-6">
          <div className="mb-3 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Total spend, all vehicles</p>
            <p className="mt-1 text-xl font-bold tracking-tight tabular-nums text-slate-800">
              {formatPaiseAsInr(dashboard.summaries.reduce((sum, s) => sum + s.spendPaise, 0))}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {vehicles.map((vehicle) => {
              const summary = summaryById.get(vehicle.id);
              return summary ? <VehicleCompareCard key={vehicle.id} vehicle={vehicle} summary={summary} /> : null;
            })}
          </div>
        </div>
      )}

      {dashboard && (
        <div className="mb-6">
          <h2 className="mb-2 text-base font-bold text-slate-900">Monthly Spend</h2>
          <VehicleTrendChart dashboard={dashboard} vehicles={selectedVehicles} />
        </div>
      )}

      <div>
        <h2 className="mb-2 text-base font-bold text-slate-900">History</h2>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          {visibleLogs.length === 0 && <p className="py-4 text-sm text-slate-500">No entries in this period.</p>}
          <div className="divide-y divide-slate-100">
            {visibleLogs.map((log) => {
              const vehicle = vehicleById.get(log.vehicleId);
              if (!vehicle) return null;
              return (
                <VehicleLogRow
                  key={log.id}
                  log={log}
                  vehicle={vehicle}
                  showVehicle={view === ALL_VIEW}
                  onEdit={() => setFormState({ vehicle, existing: log })}
                  onDelete={() => handleDelete(log)}
                />
              );
            })}
          </div>
        </div>
      </div>

      {formState && (
        <VehicleLogForm
          vehicle={formState.vehicle}
          existing={formState.existing}
          lastOdometerKm={summaryById.get(formState.vehicle.id)?.latestOdometerKm ?? null}
          onClose={() => setFormState(null)}
          onSaved={() => {
            setFormState(null);
            fetchDashboard();
          }}
        />
      )}

      {settingsFor && (
        <VehicleSettingsForm
          vehicles={vehicles}
          initialVehicle={settingsFor}
          onClose={() => setSettingsFor(null)}
          onSaved={() => {
            setSettingsFor(null);
            fetchDashboard();
          }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, detail, tone }: { label: string; value: string; detail?: string; tone?: "negative" }) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 truncate text-xl font-bold tracking-tight tabular-nums ${tone === "negative" ? "text-red-600" : "text-slate-800"}`}>{value}</p>
      {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
    </div>
  );
}

function efficiencyText(vehicle: VehicleApi, summary: VehicleSummary): { value: string; detail: string } {
  if (summary.efficiency === null) {
    return {
      value: "—",
      detail: vehicle.kind === "ev" ? "Needs two or more charges" : "Needs two full-tank fills",
    };
  }
  return {
    value: `${formatNumber(summary.efficiency)} ${efficiencyUnit(vehicle)}`,
    detail: vehicle.kind === "ev" ? `${formatNumber(1000 / summary.efficiency, 0)} Wh/km` : "Full tank to full tank",
  };
}

function VehicleStats({ vehicle, summary }: { vehicle: VehicleApi; summary: VehicleSummary }) {
  const efficiency = efficiencyText(vehicle, summary);
  const entryLabel = vehicle.kind === "ev" ? "charge" : "fill-up";
  return (
    <div className="mb-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={vehicle.kind === "ev" ? "Charging spend" : "Petrol spend"}
          value={formatPaiseAsInr(summary.spendPaise)}
          tone="negative"
          detail={`${summary.entries} ${entryLabel}${summary.entries === 1 ? "" : "s"} · ${formatNumber(summary.quantity)} ${unitFor(vehicle)}`}
        />
        <StatCard
          label="Km driven"
          value={`${formatNumber(summary.kmDriven, 0)} km`}
          detail={summary.latestOdometerKm !== null ? `Odometer ${formatNumber(summary.latestOdometerKm, 0)} km` : "Set odometer in settings"}
        />
        <StatCard label="Mileage" value={efficiency.value} detail={efficiency.detail} />
        <StatCard
          label="Cost per km"
          value={summary.costPerKmPaise !== null ? formatPaiseAsInr(summary.costPerKmPaise) : "—"}
          detail={summary.avgUnitPricePaise !== null ? `Avg ${formatPaiseAsInr(summary.avgUnitPricePaise)}/${unitFor(vehicle)}` : undefined}
        />
      </div>

      {(summary.monthlySpendPaise !== null || summary.byChargerType) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {summary.monthlySpendPaise !== null && (
            <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
              <p className="text-xs text-slate-500">Monthly average</p>
              <p className="text-sm font-semibold tabular-nums text-slate-800">
                {formatPaiseAsInr(summary.monthlySpendPaise)} · {formatNumber(summary.monthlyKm ?? 0, 0)} km
              </p>
            </div>
          )}
          {summary.byChargerType &&
            (Object.keys(CHARGER_LABELS) as ChargerType[])
              .filter((type) => summary.byChargerType![type].quantity > 0)
              .map((type) => {
                const split = summary.byChargerType![type];
                const share = summary.quantity > 0 ? Math.round((split.quantity / summary.quantity) * 100) : 0;
                return (
                  <div key={type} className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
                    <p className="text-xs text-slate-500">{CHARGER_LABELS[type]} · {share}% of kWh</p>
                    <p className="text-sm font-semibold tabular-nums text-slate-800">
                      {formatNumber(split.quantity)} kWh · {formatPaiseAsInr(split.amountPaise)}
                    </p>
                    <p className="text-[11px] text-slate-500">Avg {formatPaiseAsInr(Math.round(split.amountPaise / split.quantity))}/kWh</p>
                  </div>
                );
              })}
        </div>
      )}
    </div>
  );
}

function VehicleCompareCard({ vehicle, summary }: { vehicle: VehicleApi; summary: VehicleSummary }) {
  const efficiency = efficiencyText(vehicle, summary);
  const rows = [
    { label: "Spend", value: formatPaiseAsInr(summary.spendPaise) },
    { label: "Km driven", value: `${formatNumber(summary.kmDriven, 0)} km` },
    { label: "Mileage", value: efficiency.value },
    { label: "Cost per km", value: summary.costPerKmPaise !== null ? formatPaiseAsInr(summary.costPerKmPaise) : "—" },
    { label: vehicle.kind === "ev" ? "Energy added" : "Petrol added", value: `${formatNumber(summary.quantity)} ${unitFor(vehicle)}` },
  ];
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="truncate text-sm font-bold text-slate-900">{vehicle.name}</p>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${vehicle.kind === "ev" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
          {vehicle.kind === "ev" ? "EV" : "Petrol"}
        </span>
      </div>
      <dl className="divide-y divide-slate-100">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 py-1.5">
            <dt className="text-xs text-slate-500">{row.label}</dt>
            <dd className="text-sm font-semibold tabular-nums text-slate-800">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function VehicleTrendChart({ dashboard, vehicles }: { dashboard: VehiclesDashboardResponse; vehicles: VehicleApi[] }) {
  const colorFor = (vehicle: VehicleApi) => VEHICLE_COLORS[dashboard.vehicles.findIndex((v) => v.id === vehicle.id) % VEHICLE_COLORS.length];
  const data = dashboard.trend.map((point) => {
    const [y, m] = point.month.split("-").map(Number);
    const row: Record<string, string | number> = {
      month: new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1))),
      label: new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1))),
    };
    for (const vehicle of vehicles) {
      row[vehicle.name] = paiseToRupees(point.spendPaise[vehicle.id] ?? 0);
      row[`${vehicle.name} km`] = point.km[vehicle.id] ?? 0;
    }
    return row;
  });

  return (
    <div className="h-64 rounded-xl border border-slate-200 bg-white p-2 sm:p-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={4} />
          <YAxis tick={{ fontSize: 11 }} width={48} tickFormatter={(value: number) => (value >= 1000 ? `${formatNumber(value / 1000, 1)}k` : String(value))} />
          <Tooltip
            labelFormatter={(_label, payload) => String(payload?.[0]?.payload?.label ?? _label)}
            formatter={(value: number, name: string, item) => {
              const km = item?.payload?.[`${name} km`];
              return [`₹${value.toLocaleString("en-IN")}${km ? ` · ${formatNumber(Number(km), 0)} km` : ""}`, name];
            }}
          />
          {vehicles.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {vehicles.map((vehicle) => (
            <Bar key={vehicle.id} dataKey={vehicle.name} stackId="spend" fill={colorFor(vehicle)} radius={vehicles.length > 1 ? 0 : [4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function VehicleLogRow({
  log,
  vehicle,
  showVehicle,
  onEdit,
  onDelete,
}: {
  log: VehicleLogApi;
  vehicle: VehicleApi;
  showVehicle: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const unitPricePaise = log.quantity > 0 ? Math.round(log.amountPaise / log.quantity) : 0;
  const tag = vehicle.kind === "ev" ? (log.chargerType ? CHARGER_LABELS[log.chargerType] : "Charge") : log.fullTank ? "Full tank" : "Partial";
  const details = [
    log.distanceKm !== null ? `${formatNumber(log.distanceKm, 0)} km since last` : null,
    log.efficiency !== null ? `${formatNumber(log.efficiency)} ${efficiencyUnit(vehicle)}` : null,
    log.socStartPct !== null && log.socEndPct !== null ? `${log.socStartPct}% → ${log.socEndPct}%` : null,
    log.location || null,
  ].filter(Boolean);

  return (
    <div className="py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800">
            {formatDate(log.date)}
            {showVehicle && <span className="text-slate-500"> · {vehicle.name}</span>}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {formatNumber(log.odometerKm, 0)} km · {formatNumber(log.quantity)} {unitFor(vehicle)}
            {log.quantityEstimated ? " (est.)" : ""} @ {formatPaiseAsInr(unitPricePaise)}/{unitFor(vehicle)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold tabular-nums text-slate-800">{formatPaiseAsInr(log.amountPaise)}</p>
          <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${vehicle.kind === "ev" ? "bg-emerald-50 text-emerald-700" : log.fullTank ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
            {tag}
          </span>
        </div>
      </div>
      {(details.length > 0 || log.note) && (
        <p className="mt-1 text-xs text-slate-600">
          {details.join(" · ")}
          {log.note && <span className="text-slate-500">{details.length > 0 ? " · " : ""}{log.note}</span>}
        </p>
      )}
      <div className="mt-1 flex gap-1">
        <button type="button" onClick={onEdit} className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100">
          Edit
        </button>
        <button type="button" onClick={onDelete} className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50">
          Delete
        </button>
      </div>
    </div>
  );
}

function parseOptionalNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function apiErrorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "error" in data) {
    const error = (data as { error: unknown }).error;
    if (typeof error === "string") return error;
    if (error && typeof error === "object") {
      const flat = error as { formErrors?: string[]; fieldErrors?: Record<string, string[]> };
      const first = flat.formErrors?.[0] ?? Object.values(flat.fieldErrors ?? {})[0]?.[0];
      if (first) return first;
    }
  }
  return fallback;
}

function VehicleLogForm({
  vehicle,
  existing,
  lastOdometerKm,
  onClose,
  onSaved,
}: {
  vehicle: VehicleApi;
  existing?: VehicleLogApi;
  lastOdometerKm: number | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEv = vehicle.kind === "ev";
  const [date, setDate] = useState(existing?.date ?? todayStr());
  const [odometer, setOdometer] = useState(existing ? String(existing.odometerKm) : "");
  const [quantity, setQuantity] = useState(existing ? String(existing.quantity) : "");
  // When editing, litres and total are pre-filled, so ₹/L stays empty and is worked out again.
  const [unitPrice, setUnitPrice] = useState("");
  const [total, setTotal] = useState(existing ? (existing.amountPaise / 100).toFixed(2) : "");
  const [fullTank, setFullTank] = useState(existing?.fullTank ?? true);
  const [chargerType, setChargerType] = useState<ChargerType>(existing?.chargerType ?? "home");
  const [socStart, setSocStart] = useState(existing?.socStartPct != null ? String(existing.socStartPct) : "");
  const [socEnd, setSocEnd] = useState(existing?.socEndPct != null ? String(existing.socEndPct) : "");
  const [location, setLocation] = useState(existing?.location ?? "");
  const [note, setNote] = useState(existing?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Home charging is entered the way the vehicle's settings say: kWh from the charger, or battery %.
  const homeBySoc = isEv && chargerType === "home" && vehicle.homeChargeInput === "soc";
  const socStartNum = parseOptionalNumber(socStart);
  const socEndNum = parseOptionalNumber(socEnd);
  const socKwh =
    homeBySoc && vehicle.batteryCapacityKwh !== null && socStartNum !== null && socEndNum !== null && socEndNum > socStartNum
      ? Math.round(vehicle.batteryCapacityKwh * (socEndNum - socStartNum)) / 100
      : null;
  const effectiveKwh = homeBySoc ? socKwh : parseOptionalNumber(quantity);
  const homeCostPaise =
    isEv && chargerType === "home" && vehicle.homeTariffPaisePerKwh !== null && effectiveKwh !== null
      ? Math.round(effectiveKwh * vehicle.homeTariffPaisePerKwh)
      : null;

  // Petrol: any two of litres, price per litre and total give the third.
  const litresNum = parseOptionalNumber(quantity);
  const priceNum = parseOptionalNumber(unitPrice);
  const totalNum = parseOptionalNumber(total);
  const petrolPreview = !isEv
    ? litresNum !== null && priceNum !== null && totalNum === null
      ? `Total ${formatPaiseAsInr(Math.round(litresNum * priceNum * 100))}`
      : litresNum === null && priceNum && totalNum !== null
        ? `${formatNumber(totalNum / priceNum)} L`
        : litresNum && priceNum === null && totalNum !== null
          ? `${formatPaiseAsInr(Math.round((totalNum / litresNum) * 100))}/L`
          : null
    : null;
  const tankWarning =
    !isEv && vehicle.tankCapacityLitres !== null && litresNum !== null && litresNum > vehicle.tankCapacityLitres
      ? `More than the ${vehicle.tankCapacityLitres} L tank — check the litres.`
      : null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const odometerKm = parseOptionalNumber(odometer);
    if (odometerKm === null || odometerKm < 0) {
      setError("Enter the odometer reading.");
      return;
    }

    let quantityValue: number | null;
    let amountPaise: number | null;
    let quantityEstimated = false;

    if (isEv) {
      if (homeBySoc) {
        if (vehicle.batteryCapacityKwh === null) {
          setError("Add the battery size in Settings to use battery %.");
          return;
        }
        if (socKwh === null) {
          setError("Enter battery % before and after charging (after must be higher).");
          return;
        }
        quantityValue = socKwh;
        quantityEstimated = true;
      } else {
        quantityValue = parseOptionalNumber(quantity);
      }
      amountPaise = totalNum !== null ? Math.round(totalNum * 100) : homeCostPaise;
      if (amountPaise === null) {
        setError(chargerType === "home" ? "Enter the cost, or add your home electricity rate in Settings." : "Enter the cost.");
        return;
      }
    } else {
      if (litresNum !== null && priceNum !== null && totalNum === null) {
        quantityValue = litresNum;
        amountPaise = Math.round(litresNum * priceNum * 100);
      } else if (litresNum === null && priceNum && totalNum !== null) {
        quantityValue = Math.round((totalNum / priceNum) * 100) / 100;
        amountPaise = Math.round(totalNum * 100);
        quantityEstimated = true;
      } else {
        quantityValue = litresNum;
        amountPaise = totalNum !== null ? Math.round(totalNum * 100) : null;
      }
      if (amountPaise === null) {
        setError("Enter any two of litres, price per litre and total.");
        return;
      }
    }

    if (quantityValue === null || quantityValue <= 0) {
      setError(isEv ? "Enter the kWh added." : "Enter the litres filled.");
      return;
    }

    const payload = {
      date,
      odometerKm,
      quantity: quantityValue,
      amountPaise,
      fullTank: !isEv && fullTank,
      chargerType: isEv ? chargerType : null,
      socStartPct: isEv ? socStartNum : null,
      socEndPct: isEv ? socEndNum : null,
      quantityEstimated,
      location,
      note,
    };

    setSubmitting(true);
    const response = await fetch(existing ? `/api/vehicles/logs/${existing.id}` : "/api/vehicles/logs", {
      method: existing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(existing ? payload : { ...payload, vehicleId: vehicle.id }),
    });
    setSubmitting(false);

    if (!response.ok) {
      setError(apiErrorMessage(await response.json().catch(() => null), "Could not save the entry. Check the values and try again."));
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:px-4">
      <form
        onSubmit={handleSubmit}
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-lg sm:rounded-xl sm:p-6"
      >
        <h2 className="mb-1 text-lg font-semibold">
          {existing ? "Edit" : "Add"} {isEv ? "charge" : "fill-up"}
        </h2>
        <p className="mb-4 text-xs text-slate-500">{vehicle.name}</p>

        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <label className={labelClass}>Date</label>
            <input type="date" required min={vehicle.trackingStartDate} value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </div>
          <div className="min-w-0">
            <label className={labelClass}>Odometer (km)</label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.1"
              required
              value={odometer}
              onChange={(e) => setOdometer(e.target.value)}
              placeholder={lastOdometerKm !== null ? `Last ${lastOdometerKm}` : undefined}
              className={inputClass}
            />
          </div>
        </div>

        {isEv && (
          <div className="mt-3">
            <label className={labelClass}>Charger</label>
            <div className="grid grid-cols-3 gap-1 rounded-lg border border-emerald-200 bg-emerald-50 p-1" role="group" aria-label="Charger type">
              {(Object.keys(CHARGER_LABELS) as ChargerType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  aria-pressed={chargerType === type}
                  onClick={() => setChargerType(type)}
                  className={`min-h-10 rounded-md px-2 text-sm font-semibold ${chargerType === type ? "bg-emerald-200 text-emerald-950 shadow-sm ring-1 ring-emerald-300" : "bg-white/70 text-slate-700 hover:bg-emerald-100"}`}
                >
                  {CHARGER_LABELS[type]}
                </button>
              ))}
            </div>
          </div>
        )}

        {isEv ? (
          <>
            {!homeBySoc && (
              <div className="mt-3">
                <label className={labelClass}>Energy added (kWh)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className={inputClass}
                />
              </div>
            )}
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="min-w-0">
                <label className={labelClass}>Battery before (%){homeBySoc ? "" : " · optional"}</label>
                <input type="number" inputMode="numeric" min="0" max="100" step="1" required={homeBySoc} value={socStart} onChange={(e) => setSocStart(e.target.value)} className={inputClass} />
              </div>
              <div className="min-w-0">
                <label className={labelClass}>Battery after (%){homeBySoc ? "" : " · optional"}</label>
                <input type="number" inputMode="numeric" min="0" max="100" step="1" required={homeBySoc} value={socEnd} onChange={(e) => setSocEnd(e.target.value)} className={inputClass} />
              </div>
            </div>
            {homeBySoc && (
              <p className="mt-1 text-xs text-slate-500">
                {vehicle.batteryCapacityKwh === null
                  ? "Add the battery size in Settings to estimate kWh."
                  : socKwh !== null
                    ? `≈ ${formatNumber(socKwh)} kWh from a ${vehicle.batteryCapacityKwh} kWh battery`
                    : `kWh is estimated from a ${vehicle.batteryCapacityKwh} kWh battery`}
              </p>
            )}
            <div className="mt-3">
              <label className={labelClass}>Cost (INR){homeCostPaise !== null ? " · optional" : ""}</label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                required={homeCostPaise === null}
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                placeholder={homeCostPaise !== null ? (homeCostPaise / 100).toFixed(2) : undefined}
                className={inputClass}
              />
              {homeCostPaise !== null && total.trim() === "" && (
                <p className="mt-1 text-xs text-slate-500">
                  {formatPaiseAsInr(homeCostPaise)} at your home rate of {formatPaiseAsInr(vehicle.homeTariffPaisePerKwh!)}/kWh
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="min-w-0">
                <label className={labelClass}>Litres</label>
                <input type="number" inputMode="decimal" min="0" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputClass} />
              </div>
              <div className="min-w-0">
                <label className={labelClass}>₹ / L</label>
                <input type="number" inputMode="decimal" min="0" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className={inputClass} />
              </div>
              <div className="min-w-0">
                <label className={labelClass}>Total ₹</label>
                <input type="number" inputMode="decimal" min="0" step="0.01" value={total} onChange={(e) => setTotal(e.target.value)} className={inputClass} />
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-500">{petrolPreview ?? "Fill any two — the third is worked out."}</p>
            {tankWarning && <p className="mt-1 text-xs font-medium text-amber-700">{tankWarning}</p>}
            <label className="mt-3 flex min-h-10 items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={fullTank} onChange={(e) => setFullTank(e.target.checked)} className="h-4 w-4 accent-emerald-600" />
              Filled to full tank
            </label>
            <p className="text-xs text-slate-500">Mileage is measured between two full-tank fills.</p>
          </>
        )}

        <div className="mt-3">
          <label className={labelClass}>{isEv ? "Charger / location" : "Fuel station"} · optional</label>
          <input type="text" maxLength={100} value={location} onChange={(e) => setLocation(e.target.value)} className={inputClass} />
        </div>
        <div className="mt-3">
          <label className={labelClass}>Note · optional</label>
          <input type="text" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700">
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="min-h-11 flex-1 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
            {submitting ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

function VehicleSettingsForm({
  vehicles,
  initialVehicle,
  onClose,
  onSaved,
}: {
  vehicles: VehicleApi[];
  initialVehicle: VehicleApi;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [vehicleId, setVehicleId] = useState(initialVehicle.id);
  const vehicle = vehicles.find((v) => v.id === vehicleId) ?? initialVehicle;
  const [name, setName] = useState(vehicle.name);
  const [registrationNumber, setRegistrationNumber] = useState(vehicle.registrationNumber);
  const [trackingStartDate, setTrackingStartDate] = useState(vehicle.trackingStartDate);
  const [startOdometer, setStartOdometer] = useState(vehicle.startOdometerKm !== null ? String(vehicle.startOdometerKm) : "");
  const [capacity, setCapacity] = useState(
    String((vehicle.kind === "ev" ? vehicle.batteryCapacityKwh : vehicle.tankCapacityLitres) ?? "")
  );
  const [homeTariff, setHomeTariff] = useState(vehicle.homeTariffPaisePerKwh !== null ? (vehicle.homeTariffPaisePerKwh / 100).toString() : "");
  const [homeChargeInput, setHomeChargeInput] = useState<HomeChargeInput>(vehicle.homeChargeInput);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function switchVehicle(next: VehicleApi) {
    setVehicleId(next.id);
    setName(next.name);
    setRegistrationNumber(next.registrationNumber);
    setTrackingStartDate(next.trackingStartDate);
    setStartOdometer(next.startOdometerKm !== null ? String(next.startOdometerKm) : "");
    setCapacity(String((next.kind === "ev" ? next.batteryCapacityKwh : next.tankCapacityLitres) ?? ""));
    setHomeTariff(next.homeTariffPaisePerKwh !== null ? (next.homeTariffPaisePerKwh / 100).toString() : "");
    setHomeChargeInput(next.homeChargeInput);
    setError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const capacityNum = parseOptionalNumber(capacity);
    const tariffNum = parseOptionalNumber(homeTariff);
    if (vehicle.kind === "ev" && homeChargeInput === "soc" && capacityNum === null) {
      setError("Battery size is needed to estimate kWh from battery %.");
      return;
    }

    const payload =
      vehicle.kind === "ev"
        ? {
            batteryCapacityKwh: capacityNum,
            homeTariffPaisePerKwh: tariffNum !== null ? Math.round(tariffNum * 100) : null,
            homeChargeInput,
          }
        : { tankCapacityLitres: capacityNum };

    setSubmitting(true);
    const response = await fetch(`/api/vehicles/${vehicle.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        registrationNumber,
        trackingStartDate,
        startOdometerKm: parseOptionalNumber(startOdometer),
        ...payload,
      }),
    });
    setSubmitting(false);
    if (!response.ok) {
      setError(apiErrorMessage(await response.json().catch(() => null), "Could not save settings."));
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:px-4">
      <form onSubmit={handleSubmit} className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-lg sm:rounded-xl sm:p-6">
        <h2 className="mb-3 text-lg font-semibold">Vehicle settings</h2>

        {vehicles.length > 1 && (
          <div className="mb-4 grid gap-1 rounded-lg border border-emerald-200 bg-emerald-50 p-1" style={{ gridTemplateColumns: `repeat(${vehicles.length}, minmax(0, 1fr))` }} role="group" aria-label="Vehicle to configure">
            {vehicles.map((v) => (
              <button
                key={v.id}
                type="button"
                aria-pressed={v.id === vehicleId}
                onClick={() => switchVehicle(v)}
                className={`min-h-10 min-w-0 truncate rounded-md px-2 text-sm font-semibold ${v.id === vehicleId ? "bg-emerald-200 text-emerald-950 shadow-sm ring-1 ring-emerald-300" : "bg-white/70 text-slate-700 hover:bg-emerald-100"}`}
              >
                {v.name}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <label className={labelClass}>Name</label>
            <input type="text" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </div>
          <div className="min-w-0">
            <label className={labelClass}>Registration no. · optional</label>
            <input type="text" maxLength={20} value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value.toUpperCase())} className={inputClass} />
          </div>
          <div className="min-w-0">
            <label className={labelClass}>Tracking from</label>
            <input type="date" required value={trackingStartDate} onChange={(e) => setTrackingStartDate(e.target.value)} className={inputClass} />
          </div>
          <div className="min-w-0">
            <label className={labelClass}>Odometer on that day (km)</label>
            <input type="number" inputMode="decimal" min="0" step="0.1" value={startOdometer} onChange={(e) => setStartOdometer(e.target.value)} className={inputClass} />
          </div>
          <div className="min-w-0 sm:col-span-2">
            <label className={labelClass}>{vehicle.kind === "ev" ? "Usable battery size (kWh)" : "Fuel tank size (L)"}</label>
            <input type="number" inputMode="decimal" min="0" step="0.1" value={capacity} onChange={(e) => setCapacity(e.target.value)} className={inputClass} />
          </div>
        </div>

        {vehicle.kind === "ev" && (
          <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3">
            <p className="text-sm font-semibold text-slate-800">Home charging</p>
            <label className={`${labelClass} mt-3`}>Electricity rate (₹ per kWh)</label>
            <input type="number" inputMode="decimal" min="0" step="0.01" value={homeTariff} onChange={(e) => setHomeTariff(e.target.value)} placeholder="e.g. 8.50" className={`${inputClass} bg-white`} />
            <p className="mt-1 text-xs text-slate-600">Home charge cost is worked out from this rate. You can still type a different cost.</p>

            <p className={`${labelClass} mt-3`}>How you enter a home charge</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(
                [
                  { value: "kwh", title: "kWh added", detail: "From the wallbox or the car's app" },
                  { value: "soc", title: "Battery %", detail: "Before and after; kWh is estimated" },
                ] as { value: HomeChargeInput; title: string; detail: string }[]
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={homeChargeInput === option.value}
                  onClick={() => setHomeChargeInput(option.value)}
                  className={`min-h-12 rounded-lg border px-3 py-2 text-left ${homeChargeInput === option.value ? "border-emerald-600 bg-emerald-600 text-white shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:border-emerald-400"}`}
                >
                  <span className="block text-sm font-semibold">{option.title}</span>
                  <span className={`block text-[11px] ${homeChargeInput === option.value ? "text-emerald-50" : "text-slate-500"}`}>{option.detail}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700">
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="min-h-11 flex-1 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
            {submitting ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
