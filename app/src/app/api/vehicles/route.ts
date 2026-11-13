import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ensureVehiclesSeeded } from "@/lib/seed";
import { getVehicleView } from "@/lib/settings";
import { serializeVehicle, type VehicleDoc } from "@/lib/vehicles";

export async function GET() {
  await ensureVehiclesSeeded();
  const db = await getDb();
  const docs = await db.collection<VehicleDoc>("vehicles").find({}).sort({ createdAt: 1, _id: 1 }).toArray();
  return NextResponse.json({ vehicles: docs.map(serializeVehicle), view: await getVehicleView() });
}
