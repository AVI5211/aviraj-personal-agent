import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { updateVehicleSchema } from "@/lib/validation";
import { checkTrackingStart, serializeVehicle, type VehicleDoc, type VehicleLogDoc } from "@/lib/vehicles";
import { parseObjectId } from "@/lib/transactions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const objectId = parseObjectId(id);
  if (!objectId) {
    return NextResponse.json({ error: "Invalid vehicle id" }, { status: 400 });
  }

  const parsed = updateVehicleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = await getDb();
  const existing = await db.collection<VehicleDoc>("vehicles").findOne({ _id: objectId });
  if (!existing) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  const logs = await db
    .collection<VehicleLogDoc>("vehicle_logs")
    .find({ vehicleId: objectId }, { projection: { date: 1, odometerKm: 1 } })
    .toArray();
  const startError = checkTrackingStart(
    {
      trackingStartDate: parsed.data.trackingStartDate ?? existing.trackingStartDate,
      startOdometerKm: parsed.data.startOdometerKm !== undefined ? parsed.data.startOdometerKm : existing.startOdometerKm,
    },
    logs
  );
  if (startError) {
    return NextResponse.json({ error: startError }, { status: 400 });
  }

  const result = await db
    .collection<VehicleDoc>("vehicles")
    .findOneAndUpdate({ _id: objectId }, { $set: { ...parsed.data, updatedAt: new Date() } }, { returnDocument: "after" });

  if (!result) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }
  return NextResponse.json(serializeVehicle(result));
}
