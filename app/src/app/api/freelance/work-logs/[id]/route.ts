import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { updateWorkLogSchema } from "@/lib/validation";
import { serializeWorkLog, type WorkLogDoc } from "@/lib/freelance";
import { parseObjectId } from "@/lib/transactions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const objectId = parseObjectId(id);
  if (!objectId) {
    return NextResponse.json({ error: "Invalid work log id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateWorkLogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = await getDb();
  const existing = await db.collection<WorkLogDoc>("work_logs").findOne({ _id: objectId });
  if (!existing) {
    return NextResponse.json({ error: "Work log not found" }, { status: 404 });
  }
  if (existing.invoiced) {
    return NextResponse.json({ error: "Cannot edit a work log that has already been invoiced" }, { status: 409 });
  }

  const { epicId: rawEpicId, ...rest } = parsed.data;
  const update: Record<string, unknown> = { ...rest, updatedAt: new Date() };
  if (rawEpicId !== undefined) {
    if (rawEpicId === null) {
      update.epicId = null;
    } else {
      const epicObjectId = parseObjectId(rawEpicId);
      if (!epicObjectId) {
        return NextResponse.json({ error: "Invalid epicId" }, { status: 400 });
      }
      update.epicId = epicObjectId;
    }
  }

  const result = await db.collection<WorkLogDoc>("work_logs").findOneAndUpdate(
    { _id: objectId },
    { $set: update },
    { returnDocument: "after" }
  );

  if (!result) {
    return NextResponse.json({ error: "Work log not found" }, { status: 404 });
  }

  return NextResponse.json(serializeWorkLog(result));
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const objectId = parseObjectId(id);
  if (!objectId) {
    return NextResponse.json({ error: "Invalid work log id" }, { status: 400 });
  }

  const db = await getDb();
  const existing = await db.collection<WorkLogDoc>("work_logs").findOne({ _id: objectId });
  if (!existing) {
    return NextResponse.json({ error: "Work log not found" }, { status: 404 });
  }
  if (existing.invoiced) {
    return NextResponse.json({ error: "Cannot delete a work log that has already been invoiced" }, { status: 409 });
  }

  await db.collection("work_logs").deleteOne({ _id: objectId });

  return NextResponse.json({ ok: true });
}
