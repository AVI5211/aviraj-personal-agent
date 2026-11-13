import type { ObjectId } from "mongodb";
import type {
  ChargerType,
  HomeChargeInput,
  VehicleApi,
  VehicleChargerSplit,
  VehicleKind,
  VehicleLogApi,
  VehicleSummary,
  VehicleTrendPoint,
} from "@/lib/types";
import { CHARGER_TYPES } from "@/lib/validation";

const DAYS_PER_MONTH = 365.25 / 12;
// Below this many days a "per month" figure is just one fill-up scaled up, so it is hidden.
const MIN_DAYS_FOR_MONTHLY_AVERAGE = 28;

export interface VehicleDoc {
  _id: ObjectId;
  /** Set only on the vehicles created automatically, so seeding never duplicates them. */
  seedKey?: string;
  name: string;
  kind: VehicleKind;
  registrationNumber: string;
  trackingStartDate: string;
  startOdometerKm: number | null;
  tankCapacityLitres: number | null;
  batteryCapacityKwh: number | null;
  homeTariffPaisePerKwh: number | null;
  homeChargeInput: HomeChargeInput;
  createdAt: Date;
  updatedAt: Date;
}

export interface VehicleLogDoc {
  _id: ObjectId;
  vehicleId: ObjectId;
  date: string;
  odometerKm: number;
  quantity: number;
  amountPaise: number;
  fullTank: boolean;
  chargerType: ChargerType | null;
  socStartPct: number | null;
  socEndPct: number | null;
  quantityEstimated: boolean;
  location: string;
  note: string;
  createdAt: Date;
  updatedAt: Date;
}

export const DEFAULT_VEHICLES: Omit<VehicleDoc, "_id" | "trackingStartDate" | "createdAt" | "updatedAt">[] = [
  {
    seedKey: "harrier_ev",
    name: "Harrier EV",
    kind: "ev",
    registrationNumber: "",
    startOdometerKm: null,
    tankCapacityLitres: null,
    batteryCapacityKwh: null,
    homeTariffPaisePerKwh: null,
    homeChargeInput: "kwh",
  },
  {
    seedKey: "hunter_350",
    name: "Hunter 350",
    kind: "petrol",
    registrationNumber: "",
    startOdometerKm: null,
    tankCapacityLitres: 13,
    batteryCapacityKwh: null,
    homeTariffPaisePerKwh: null,
    homeChargeInput: "kwh",
  },
];

export function serializeVehicle(doc: VehicleDoc): VehicleApi {
  return {
    id: doc._id.toString(),
    name: doc.name,
    kind: doc.kind,
    registrationNumber: doc.registrationNumber,
    trackingStartDate: doc.trackingStartDate,
    startOdometerKm: doc.startOdometerKm,
    tankCapacityLitres: doc.tankCapacityLitres,
    batteryCapacityKwh: doc.batteryCapacityKwh,
    homeTariffPaisePerKwh: doc.homeTariffPaisePerKwh,
    homeChargeInput: doc.homeChargeInput,
  };
}

export function serializeVehicleLog(doc: VehicleLogDoc, metrics?: LogMetrics): VehicleLogApi {
  return {
    id: doc._id.toString(),
    vehicleId: doc.vehicleId.toString(),
    date: doc.date,
    odometerKm: doc.odometerKm,
    quantity: doc.quantity,
    amountPaise: doc.amountPaise,
    fullTank: doc.fullTank,
    chargerType: doc.chargerType,
    socStartPct: doc.socStartPct,
    socEndPct: doc.socEndPct,
    quantityEstimated: doc.quantityEstimated,
    location: doc.location,
    note: doc.note,
    distanceKm: metrics?.distanceKm ?? null,
    efficiency: metrics?.efficiency ?? null,
  };
}

/** kWh added at home, estimated from the battery % gained when the charger reports no kWh. */
export function kwhFromSoc(batteryCapacityKwh: number, socStartPct: number, socEndPct: number): number {
  return roundTo((batteryCapacityKwh * (socEndPct - socStartPct)) / 100, 2);
}

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export interface VehicleLike {
  kind: VehicleKind;
  startOdometerKm: number | null;
  batteryCapacityKwh: number | null;
}

export interface LogLike {
  id: string;
  date: string;
  odometerKm: number;
  quantity: number;
  amountPaise: number;
  fullTank: boolean;
  chargerType: ChargerType | null;
  socStartPct: number | null;
  socEndPct: number | null;
  createdAt?: number;
}

export interface LogMetrics {
  distanceKm: number | null;
  /** Distance and energy that the efficiency figure for this entry is based on. */
  efficiencyDistanceKm: number | null;
  efficiencyQuantity: number | null;
  efficiency: number | null;
}

export function sortLogs<T extends LogLike>(logs: T[]): T[] {
  return [...logs].sort(
    (a, b) => a.date.localeCompare(b.date) || a.odometerKm - b.odometerKm || (a.createdAt ?? 0) - (b.createdAt ?? 0)
  );
}

/**
 * Per-entry distance and efficiency, computed over the vehicle's full history.
 *
 * Petrol uses the full-tank method: only a full fill closes a measurement, covering the km
 * since the previous full fill and every litre added since then (partial fills included).
 * EV uses the energy used since the previous charge: from the battery % drop when both
 * readings and the battery size are known, otherwise the kWh added now (assumes charging
 * back to a similar level).
 */
export function computeLogMetrics(vehicle: VehicleLike, logs: LogLike[]): Map<string, LogMetrics> {
  const result = new Map<string, LogMetrics>();
  const sorted = sortLogs(logs);
  let previous: LogLike | null = null;
  let lastFull: LogLike | null = null;
  let litresSinceLastFull = 0;

  for (const log of sorted) {
    const baselineOdometer = previous ? previous.odometerKm : vehicle.startOdometerKm;
    const distanceKm = baselineOdometer === null ? null : Math.max(0, log.odometerKm - baselineOdometer);
    let efficiencyDistanceKm: number | null = null;
    let efficiencyQuantity: number | null = null;

    if (vehicle.kind === "petrol") {
      litresSinceLastFull += log.quantity;
      if (log.fullTank) {
        if (lastFull) {
          efficiencyDistanceKm = log.odometerKm - lastFull.odometerKm;
          efficiencyQuantity = litresSinceLastFull;
        }
        lastFull = log;
        litresSinceLastFull = 0;
      }
    } else if (previous && distanceKm !== null) {
      efficiencyDistanceKm = distanceKm;
      const canUseSoc =
        vehicle.batteryCapacityKwh !== null && previous.socEndPct !== null && log.socStartPct !== null;
      efficiencyQuantity = canUseSoc
        ? (vehicle.batteryCapacityKwh! * (previous.socEndPct! - log.socStartPct!)) / 100
        : log.quantity;
    }

    const valid =
      efficiencyDistanceKm !== null && efficiencyQuantity !== null && efficiencyDistanceKm > 0 && efficiencyQuantity > 0;
    result.set(log.id, {
      distanceKm,
      efficiencyDistanceKm: valid ? efficiencyDistanceKm : null,
      efficiencyQuantity: valid ? efficiencyQuantity : null,
      efficiency: valid ? roundTo(efficiencyDistanceKm! / efficiencyQuantity!, 2) : null,
    });
    previous = log;
  }

  return result;
}

function inRange(date: string, from: string | null, to: string | null): boolean {
  return (!from || date >= from) && (!to || date <= to);
}

function daysBetweenInclusive(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.floor(ms / 86_400_000) + 1;
}

export function computeVehicleSummary(
  vehicleId: string,
  vehicle: VehicleLike & { trackingStartDate: string },
  logs: LogLike[],
  metrics: Map<string, LogMetrics>,
  range: { from: string | null; to: string | null },
  today: string
): VehicleSummary {
  const sorted = sortLogs(logs);
  const selected = sorted.filter((log) => inRange(log.date, range.from, range.to));

  let spendPaise = 0;
  let quantity = 0;
  let kmDriven = 0;
  let efficiencyDistance = 0;
  let efficiencyQuantity = 0;
  const byChargerType = Object.fromEntries(
    CHARGER_TYPES.map((type) => [type, { quantity: 0, amountPaise: 0 }])
  ) as Record<ChargerType, VehicleChargerSplit>;

  for (const log of selected) {
    const m = metrics.get(log.id);
    spendPaise += log.amountPaise;
    quantity += log.quantity;
    kmDriven += m?.distanceKm ?? 0;
    if (m?.efficiencyDistanceKm && m.efficiencyQuantity) {
      efficiencyDistance += m.efficiencyDistanceKm;
      efficiencyQuantity += m.efficiencyQuantity;
    }
    if (log.chargerType) {
      byChargerType[log.chargerType].quantity += log.quantity;
      byChargerType[log.chargerType].amountPaise += log.amountPaise;
    }
  }

  const efficiency = efficiencyQuantity > 0 ? roundTo(efficiencyDistance / efficiencyQuantity, 2) : null;
  const avgUnitPricePaise = quantity > 0 ? Math.round(spendPaise / quantity) : null;
  const costPerKmPaise =
    efficiency !== null && avgUnitPricePaise !== null ? Math.round(avgUnitPricePaise / efficiency) : null;

  const latest = sorted.at(-1);
  // Tracking began on the start date (or an earlier back-dated entry); a period reaching
  // further back than that would dilute the averages with days nothing was recorded.
  const firstDay = sorted[0] && sorted[0].date < vehicle.trackingStartDate ? sorted[0].date : vehicle.trackingStartDate;
  const coveredFrom = range.from && range.from > firstDay ? range.from : firstDay;
  const coveredTo = range.to && range.to < today ? range.to : today;
  const coveredDays = Math.max(0, daysBetweenInclusive(coveredFrom, coveredTo));
  const showMonthly = coveredDays >= MIN_DAYS_FOR_MONTHLY_AVERAGE;

  return {
    vehicleId,
    entries: selected.length,
    spendPaise,
    quantity: roundTo(quantity, 2),
    kmDriven: roundTo(kmDriven, 1),
    efficiency,
    avgUnitPricePaise,
    costPerKmPaise,
    latestOdometerKm: latest ? latest.odometerKm : vehicle.startOdometerKm,
    monthlySpendPaise: showMonthly ? Math.round((spendPaise / coveredDays) * DAYS_PER_MONTH) : null,
    monthlyKm: showMonthly ? roundTo((kmDriven / coveredDays) * DAYS_PER_MONTH, 0) : null,
    byChargerType: vehicle.kind === "ev" ? byChargerType : null,
  };
}

/** Spend and km per month for each vehicle, oldest month first. */
export function computeVehicleTrend(
  months: string[],
  vehicles: { id: string; logs: LogLike[]; metrics: Map<string, LogMetrics> }[]
): VehicleTrendPoint[] {
  return months.map((month) => {
    const spendPaise: Record<string, number> = {};
    const km: Record<string, number> = {};
    for (const vehicle of vehicles) {
      const monthLogs = vehicle.logs.filter((log) => log.date.startsWith(month));
      spendPaise[vehicle.id] = monthLogs.reduce((sum, log) => sum + log.amountPaise, 0);
      km[vehicle.id] = roundTo(
        monthLogs.reduce((sum, log) => sum + (vehicle.metrics.get(log.id)?.distanceKm ?? 0), 0),
        1
      );
    }
    return { month, spendPaise, km };
  });
}

/**
 * Odometer readings must not go backwards in date order. Returns an error message, or null
 * when the reading fits between the vehicle's other entries.
 */
export function checkOdometerOrder(
  vehicle: { trackingStartDate: string; startOdometerKm: number | null },
  others: { date: string; odometerKm: number }[],
  date: string,
  odometerKm: number
): string | null {
  if (date < vehicle.trackingStartDate) {
    return `Entries can't be dated before tracking started on ${vehicle.trackingStartDate}.`;
  }
  if (vehicle.startOdometerKm !== null && odometerKm < vehicle.startOdometerKm) {
    return `Odometer can't be below the starting reading of ${vehicle.startOdometerKm} km.`;
  }
  const before = others.filter((log) => log.date < date).map((log) => log.odometerKm);
  const after = others.filter((log) => log.date > date).map((log) => log.odometerKm);
  if (before.length && odometerKm < Math.max(...before)) {
    return `Odometer can't be below ${Math.max(...before)} km, recorded on an earlier date.`;
  }
  if (after.length && odometerKm > Math.min(...after)) {
    return `Odometer can't be above ${Math.min(...after)} km, recorded on a later date.`;
  }
  return null;
}

/**
 * The tracking start (date and odometer) is the baseline for every distance, so it must sit
 * before all existing entries. Returns an error message, or null when it does.
 */
export function checkTrackingStart(
  start: { trackingStartDate: string; startOdometerKm: number | null },
  logs: { date: string; odometerKm: number }[]
): string | null {
  const earlier = logs.filter((log) => log.date < start.trackingStartDate);
  if (earlier.length) {
    return `${earlier.length} existing ${earlier.length === 1 ? "entry is" : "entries are"} dated before ${start.trackingStartDate}. Edit or delete ${earlier.length === 1 ? "it" : "them"} first.`;
  }
  if (start.startOdometerKm !== null) {
    const lowest = Math.min(...logs.map((log) => log.odometerKm));
    if (logs.length && lowest < start.startOdometerKm) {
      return `An existing entry has ${lowest} km, below the starting odometer of ${start.startOdometerKm} km.`;
    }
  }
  return null;
}
