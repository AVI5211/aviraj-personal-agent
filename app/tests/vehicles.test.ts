import { describe, expect, it } from "vitest";
import {
  checkOdometerOrder,
  checkTrackingStart,
  computeLogMetrics,
  computeVehicleSummary,
  computeVehicleTrend,
  kwhFromSoc,
  type LogLike,
} from "@/lib/vehicles";

function log(overrides: Partial<LogLike> & Pick<LogLike, "id" | "date" | "odometerKm" | "quantity" | "amountPaise">): LogLike {
  return { fullTank: false, chargerType: null, socStartPct: null, socEndPct: null, ...overrides };
}

const hunter = { kind: "petrol" as const, startOdometerKm: 5000, batteryCapacityKwh: null, trackingStartDate: "2026-11-01" };
const harrier = { kind: "ev" as const, startOdometerKm: 1000, batteryCapacityKwh: 75, trackingStartDate: "2026-11-01" };

describe("computeLogMetrics — petrol full-tank method", () => {
  const logs = [
    log({ id: "a", date: "2026-11-02", odometerKm: 5100, quantity: 10, amountPaise: 105000, fullTank: true }),
    log({ id: "b", date: "2026-11-06", odometerKm: 5300, quantity: 4, amountPaise: 42000 }),
    log({ id: "c", date: "2026-11-10", odometerKm: 5450, quantity: 6, amountPaise: 63000, fullTank: true }),
  ];

  it("measures distance since the previous entry, starting from the tracking odometer", () => {
    const metrics = computeLogMetrics(hunter, logs);
    expect(metrics.get("a")?.distanceKm).toBe(100);
    expect(metrics.get("b")?.distanceKm).toBe(200);
    expect(metrics.get("c")?.distanceKm).toBe(150);
  });

  it("gives mileage only on a full fill, using every litre since the previous full fill", () => {
    const metrics = computeLogMetrics(hunter, logs);
    expect(metrics.get("a")?.efficiency).toBeNull();
    expect(metrics.get("b")?.efficiency).toBeNull();
    // 350 km on 4 + 6 litres
    expect(metrics.get("c")?.efficiency).toBe(35);
  });

  it("leaves the first distance unknown when no starting odometer is set", () => {
    const metrics = computeLogMetrics({ ...hunter, startOdometerKm: null }, logs);
    expect(metrics.get("a")?.distanceKm).toBeNull();
    expect(metrics.get("b")?.distanceKm).toBe(200);
  });
});

describe("computeLogMetrics — EV", () => {
  it("uses the battery % drop between charges when both readings are known", () => {
    const metrics = computeLogMetrics(harrier, [
      log({ id: "a", date: "2026-11-02", odometerKm: 1050, quantity: 30, amountPaise: 25500, chargerType: "home", socStartPct: 40, socEndPct: 80 }),
      log({ id: "b", date: "2026-11-05", odometerKm: 1230, quantity: 31, amountPaise: 26350, chargerType: "home", socStartPct: 50, socEndPct: 90 }),
    ]);
    // 80% → 50% of 75 kWh = 22.5 kWh used over 180 km
    expect(metrics.get("b")?.efficiencyQuantity).toBeCloseTo(22.5);
    expect(metrics.get("b")?.efficiency).toBe(8);
    expect(metrics.get("a")?.efficiency).toBeNull();
  });

  it("falls back to kWh added when battery % is missing", () => {
    const metrics = computeLogMetrics(harrier, [
      log({ id: "a", date: "2026-11-02", odometerKm: 1050, quantity: 30, amountPaise: 25500, chargerType: "home" }),
      log({ id: "b", date: "2026-11-05", odometerKm: 1230, quantity: 30, amountPaise: 66000, chargerType: "dc_fast" }),
    ]);
    expect(metrics.get("b")?.efficiency).toBe(6);
  });

  it("estimates kWh from battery % and capacity", () => {
    expect(kwhFromSoc(75, 20, 80)).toBe(45);
  });
});

describe("computeVehicleSummary", () => {
  const logs = [
    log({ id: "a", date: "2026-10-28", odometerKm: 1050, quantity: 30, amountPaise: 25500, chargerType: "home" }),
    log({ id: "b", date: "2026-11-03", odometerKm: 1230, quantity: 30, amountPaise: 66000, chargerType: "dc_fast" }),
    log({ id: "c", date: "2026-11-09", odometerKm: 1410, quantity: 20, amountPaise: 17000, chargerType: "home" }),
  ];

  it("totals only the selected period and derives cost per km", () => {
    const metrics = computeLogMetrics(harrier, logs);
    const summary = computeVehicleSummary("ev", harrier, logs, metrics, { from: "2026-11-01", to: "2026-11-14" }, "2026-11-14");

    expect(summary.entries).toBe(2);
    expect(summary.spendPaise).toBe(83000);
    expect(summary.quantity).toBe(50);
    expect(summary.kmDriven).toBe(360);
    // 360 km on 50 kWh
    expect(summary.efficiency).toBe(7.2);
    expect(summary.avgUnitPricePaise).toBe(1660);
    expect(summary.costPerKmPaise).toBe(231);
    expect(summary.latestOdometerKm).toBe(1410);
    expect(summary.byChargerType?.dc_fast).toEqual({ quantity: 30, amountPaise: 66000 });
    expect(summary.byChargerType?.home).toEqual({ quantity: 20, amountPaise: 17000 });
  });

  it("hides the monthly average for short periods and shows it for longer ones", () => {
    const metrics = computeLogMetrics(harrier, logs);
    const week = computeVehicleSummary("ev", harrier, logs, metrics, { from: "2026-11-09", to: "2026-11-14" }, "2026-11-14");
    expect(week.monthlySpendPaise).toBeNull();

    // Tracking from 1 Oct to 14 Nov is 45 days: ₹1,085 spend and 410 km scaled to a month.
    const all = computeVehicleSummary("ev", { ...harrier, trackingStartDate: "2026-10-01" }, logs, metrics, { from: null, to: null }, "2026-11-14");
    expect(all.monthlySpendPaise).toBe(Math.round((108500 / 45) * (365.25 / 12)));
    expect(all.monthlyKm).toBe(277);
  });

  it("has no charger split for petrol vehicles", () => {
    const summary = computeVehicleSummary("p", hunter, [], new Map(), { from: null, to: null }, "2026-11-14");
    expect(summary.byChargerType).toBeNull();
    expect(summary.efficiency).toBeNull();
    expect(summary.latestOdometerKm).toBe(5000);
  });
});

describe("computeVehicleTrend", () => {
  it("groups spend and km by month for each vehicle", () => {
    const logs = [
      log({ id: "a", date: "2026-10-28", odometerKm: 1050, quantity: 30, amountPaise: 25500 }),
      log({ id: "b", date: "2026-11-03", odometerKm: 1230, quantity: 30, amountPaise: 66000 }),
    ];
    const trend = computeVehicleTrend(["2026-10", "2026-11"], [{ id: "ev", logs, metrics: computeLogMetrics(harrier, logs) }]);
    expect(trend).toEqual([
      { month: "2026-10", spendPaise: { ev: 25500 }, km: { ev: 50 } },
      { month: "2026-11", spendPaise: { ev: 66000 }, km: { ev: 180 } },
    ]);
  });
});

describe("checkOdometerOrder", () => {
  const others = [
    { date: "2026-11-02", odometerKm: 5100 },
    { date: "2026-11-10", odometerKm: 5450 },
  ];

  it("accepts a reading between earlier and later entries", () => {
    expect(checkOdometerOrder(hunter, others, "2026-11-06", 5300)).toBeNull();
  });

  it("rejects readings that go backwards or jump past a later entry", () => {
    expect(checkOdometerOrder(hunter, others, "2026-11-06", 5050)).toMatch(/earlier date/);
    expect(checkOdometerOrder(hunter, others, "2026-11-06", 5500)).toMatch(/later date/);
    expect(checkOdometerOrder(hunter, [], "2026-11-06", 4000)).toMatch(/starting reading/);
  });

  it("rejects entries dated before tracking started", () => {
    expect(checkOdometerOrder(hunter, [], "2026-10-31", 5100)).toMatch(/before tracking started/);
  });
});

describe("checkTrackingStart", () => {
  const logs = [
    { date: "2026-10-20", odometerKm: 1300 },
    { date: "2026-11-10", odometerKm: 1700 },
  ];

  it("rejects a start date after existing entries", () => {
    expect(checkTrackingStart({ trackingStartDate: "2026-11-14", startOdometerKm: null }, logs)).toMatch(/2 existing entries/);
  });

  it("rejects a starting odometer above an existing entry", () => {
    expect(checkTrackingStart({ trackingStartDate: "2026-10-01", startOdometerKm: 1400 }, logs)).toMatch(/1300 km/);
  });

  it("accepts a start before every entry, or any start with no entries", () => {
    expect(checkTrackingStart({ trackingStartDate: "2026-10-01", startOdometerKm: 1155 }, logs)).toBeNull();
    expect(checkTrackingStart({ trackingStartDate: "2026-11-14", startOdometerKm: 1155 }, [])).toBeNull();
  });
});
