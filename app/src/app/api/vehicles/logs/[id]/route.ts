import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { updateVehicleLogSchema } from "@/lib/validation";
import { checkOdometerOrder, serializeVehicleLog, type VehicleDoc, type VehicleLogDoc } from "@/lib/vehicles";
import { parseObjectId } from "@/lib/transactions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const objectId = parseObjectId(id);
  if (!objectId) {
    return NextResponse.json({ error: "Invalid entry id" }, { status: 400 });
  }

  const parsed = updateVehicleLogSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = await getDb();
  const existing = await db.collection<VehicleLogDoc>("vehicle_logs").findOne({ _id: objectId });
  if (!existing) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }
  const vehicle = await db.collection<VehicleDoc>("vehicles").findOne({ _id: existing.vehicleId });
  if (!vehicle) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  const others = await db
    .collection<VehicleLogDoc>("vehicle_logs")
    .find({ vehicleId: existing.vehicleId, _id: { $ne: objectId } }, { projection: { date: 1, odometerKm: 1 } })
    .toArray();
  const odometerError = checkOdometerOrder(vehicle, others, parsed.data.date, parsed.data.odometerKm);
  if (odometerError) {
    return NextResponse.json({ error: odometerError }, { status: 400 });
  }

  const result = await db.collection<VehicleLogDoc>("vehicle_logs").findOneAndUpdate(
    { _id: objectId },
    {
      $set: {
        ...parsed.data,
        fullTank: vehicle.kind === "petrol" ? parsed.data.fullTank : false,
        chargerType: vehicle.kind === "ev" ? (parsed.data.chargerType ?? "home") : null,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  );
  if (!result) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }
  return NextResponse.json(serializeVehicleLog(result));
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const objectId = parseObjectId(id);
  if (!objectId) {
    return NextResponse.json({ error: "Invalid entry id" }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.collection("vehicle_logs").deleteOne({ _id: objectId });
  if (result.deletedCount === 0) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
