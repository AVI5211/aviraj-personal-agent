import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { createVehicleLogSchema } from "@/lib/validation";
import { checkOdometerOrder, serializeVehicleLog, type VehicleDoc, type VehicleLogDoc } from "@/lib/vehicles";
import { parseObjectId } from "@/lib/transactions";

export async function POST(request: NextRequest) {
  const parsed = createVehicleLogSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { vehicleId, ...fields } = parsed.data;
  const vehicleObjectId = parseObjectId(vehicleId);
  if (!vehicleObjectId) {
    return NextResponse.json({ error: "Invalid vehicle id" }, { status: 400 });
  }

  const db = await getDb();
  const vehicle = await db.collection<VehicleDoc>("vehicles").findOne({ _id: vehicleObjectId });
  if (!vehicle) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  const others = await db
    .collection<VehicleLogDoc>("vehicle_logs")
    .find({ vehicleId: vehicleObjectId }, { projection: { date: 1, odometerKm: 1 } })
    .toArray();
  const odometerError = checkOdometerOrder(vehicle, others, fields.date, fields.odometerKm);
  if (odometerError) {
    return NextResponse.json({ error: odometerError }, { status: 400 });
  }

  const now = new Date();
  const doc: Omit<VehicleLogDoc, "_id"> = {
    vehicleId: vehicleObjectId,
    ...fields,
    fullTank: vehicle.kind === "petrol" ? fields.fullTank : false,
    chargerType: vehicle.kind === "ev" ? (fields.chargerType ?? "home") : null,
    createdAt: now,
    updatedAt: now,
  };
  const result = await db.collection("vehicle_logs").insertOne(doc);
  return NextResponse.json(serializeVehicleLog({ _id: result.insertedId, ...doc }), { status: 201 });
}
