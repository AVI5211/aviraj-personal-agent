import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "@/lib/mongodb";
import { ALL_VEHICLES_VIEW, setVehicleView } from "@/lib/settings";

const viewSchema = z.object({
  view: z.string().refine((value) => value === ALL_VEHICLES_VIEW || ObjectId.isValid(value), "Invalid view"),
});

export async function PUT(request: NextRequest) {
  const parsed = viewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid vehicle" }, { status: 400 });

  if (parsed.data.view !== ALL_VEHICLES_VIEW) {
    const db = await getDb();
    const vehicle = await db.collection("vehicles").findOne({ _id: new ObjectId(parsed.data.view) }, { projection: { _id: 1 } });
    if (!vehicle) return NextResponse.json({ error: "That vehicle no longer exists" }, { status: 404 });
  }

  await setVehicleView(parsed.data.view);
  return NextResponse.json({ view: parsed.data.view });
}
