import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ensureVehiclesSeeded } from "@/lib/seed";
import { vehiclesDashboardQuerySchema } from "@/lib/validation";
import { monthsBack, resolvePeriod, todayInShopTz } from "@/lib/dates";
import {
  computeLogMetrics,
  computeVehicleSummary,
  computeVehicleTrend,
  serializeVehicle,
  serializeVehicleLog,
  type LogLike,
  type VehicleDoc,
  type VehicleLogDoc,
} from "@/lib/vehicles";

function toLogLike(doc: VehicleLogDoc): LogLike {
  return { ...doc, id: doc._id.toString(), createdAt: doc.createdAt.getTime() };
}

export async function GET(request: NextRequest) {
  const parsed = vehiclesDashboardQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  let range;
  try {
    range = resolvePeriod(parsed.data.period, { from: parsed.data.from, to: parsed.data.to });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  await ensureVehiclesSeeded();
  const db = await getDb();
  const [vehicleDocs, logDocs] = await Promise.all([
    db.collection<VehicleDoc>("vehicles").find({}).sort({ createdAt: 1, _id: 1 }).toArray(),
    db.collection<VehicleLogDoc>("vehicle_logs").find({}).toArray(),
  ]);

  // Metrics need each vehicle's full history (distance since the previous entry, full tank to
  // full tank), so every log is loaded and only the output is limited to the selected period.
  const today = todayInShopTz();
  const perVehicle = vehicleDocs.map((vehicle) => {
    const docs = logDocs.filter((log) => log.vehicleId.equals(vehicle._id));
    const logs = docs.map(toLogLike);
    return { id: vehicle._id.toString(), vehicle, docs, logs, metrics: computeLogMetrics(vehicle, logs) };
  });

  const logsInRange = perVehicle
    .flatMap(({ docs, metrics }) =>
      docs
        .filter((doc) => (!range.from || doc.date >= range.from) && (!range.to || doc.date <= range.to))
        .map((doc) => serializeVehicleLog(doc, metrics.get(doc._id.toString())))
    )
    .sort((a, b) => b.date.localeCompare(a.date) || b.odometerKm - a.odometerKm);

  return NextResponse.json({
    range,
    vehicles: vehicleDocs.map(serializeVehicle),
    summaries: perVehicle.map(({ id, vehicle, logs, metrics }) =>
      computeVehicleSummary(id, vehicle, logs, metrics, range, today)
    ),
    logs: logsInRange,
    trend: computeVehicleTrend(monthsBack(12), perVehicle),
  });
}
