import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { updateClientSchema } from "@/lib/validation";
import { serializeClient, type ClientDoc } from "@/lib/freelance";
import { parseObjectId } from "@/lib/transactions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const objectId = parseObjectId(id);
  if (!objectId) {
    return NextResponse.json({ error: "Invalid client id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateClientSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.collection<ClientDoc>("clients").findOneAndUpdate(
    { _id: objectId },
    { $set: { ...parsed.data, updatedAt: new Date() } },
    { returnDocument: "after" }
  );

  if (!result) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  return NextResponse.json(serializeClient(result));
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const objectId = parseObjectId(id);
  if (!objectId) {
    return NextResponse.json({ error: "Invalid client id" }, { status: 400 });
  }

  const db = await getDb();

  const [workLogCount, invoiceCount] = await Promise.all([
    db.collection("work_logs").countDocuments({ clientId: objectId }),
    db.collection("invoices").countDocuments({ clientId: objectId }),
  ]);

  if (workLogCount > 0 || invoiceCount > 0) {
    return NextResponse.json(
      { error: "Cannot delete a client with existing work logs or invoices" },
      { status: 409 }
    );
  }

  const result = await db.collection<ClientDoc>("clients").deleteOne({ _id: objectId });

  if (result.deletedCount === 0) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
