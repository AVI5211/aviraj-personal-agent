import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { importWorkLogsSchema } from "@/lib/validation";
import { type ClientDoc, type EpicDoc, type WorkLogDoc } from "@/lib/freelance";
import { parseObjectId } from "@/lib/transactions";

type RowStatus = "new" | "already_recorded" | "duplicate_in_batch";

function normalizeEpicName(name: string): string {
  return name.trim().toLowerCase();
}

function rowSignature(epicName: string, date: string, hours: number, description: string): string {
  return `${normalizeEpicName(epicName)}|${date}|${hours}|${description.trim().toLowerCase()}`;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = importWorkLogsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { clientId: rawClientId, dryRun, rows } = parsed.data;

  const clientId = parseObjectId(rawClientId);
  if (!clientId) {
    return NextResponse.json({ error: "Invalid clientId" }, { status: 400 });
  }

  const db = await getDb();
  const client = await db.collection<ClientDoc>("clients").findOne({ _id: clientId });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const [existingEpics, existingLogs] = await Promise.all([
    db.collection<EpicDoc>("epics").find({ clientId }).toArray(),
    db.collection<WorkLogDoc>("work_logs").find({ clientId }).toArray(),
  ]);

  const epicIdByName = new Map(existingEpics.map((e) => [normalizeEpicName(e.name), e._id]));
  const epicNameById = new Map(existingEpics.map((e) => [e._id.toString(), e.name]));

  // The latest date already recorded per epic — anything on or before this for that
  // epic is treated as "already imported", so re-pasting the whole historical sheet
  // only ever adds rows that are genuinely new.
  const maxDateByEpicName = new Map<string, string>();
  const existingSignatures = new Set<string>();
  for (const log of existingLogs) {
    const epicName = log.epicId ? epicNameById.get(log.epicId.toString()) : undefined;
    if (epicName) {
      const key = normalizeEpicName(epicName);
      const current = maxDateByEpicName.get(key);
      if (!current || log.date > current) maxDateByEpicName.set(key, log.date);
      existingSignatures.add(rowSignature(epicName, log.date, log.billableHours, log.description));
    }
  }

  const seenInBatch = new Set<string>();
  const statuses: RowStatus[] = rows.map((row) => {
    const key = normalizeEpicName(row.epicName);
    const maxDate = maxDateByEpicName.get(key);
    if (maxDate && row.date <= maxDate) return "already_recorded";

    const signature = rowSignature(row.epicName, row.date, row.hours, row.description);
    if (existingSignatures.has(signature) || seenInBatch.has(signature)) return "already_recorded";
    seenInBatch.add(signature);
    return "new";
  });

  const counts = {
    new: statuses.filter((s) => s === "new").length,
    alreadyRecorded: statuses.filter((s) => s === "already_recorded").length,
  };

  const preview = rows.map((row, i) => ({ ...row, status: statuses[i] }));

  if (dryRun) {
    return NextResponse.json({ rows: preview, counts });
  }

  const now = new Date();
  const newEpicNames = new Set<string>();
  for (let i = 0; i < rows.length; i++) {
    if (statuses[i] === "new" && !epicIdByName.has(normalizeEpicName(rows[i].epicName))) {
      newEpicNames.add(rows[i].epicName.trim());
    }
  }

  for (const name of newEpicNames) {
    const key = normalizeEpicName(name);
    if (epicIdByName.has(key)) continue;
    const result = await db.collection("epics").insertOne({ clientId, name, createdAt: now });
    epicIdByName.set(key, result.insertedId);
  }

  const docsToInsert = rows
    .map((row, i) => ({ row, status: statuses[i] }))
    .filter(({ status }) => status === "new")
    .map(({ row }) => ({
      clientId,
      epicId: epicIdByName.get(normalizeEpicName(row.epicName)) ?? null,
      date: row.date,
      billableHours: row.hours,
      nonBillableHours: 0,
      description: row.description,
      notes: row.notes,
      invoiced: false,
      invoiceId: null,
      createdAt: now,
      updatedAt: now,
    }));

  if (docsToInsert.length > 0) {
    await db.collection("work_logs").insertMany(docsToInsert);
  }

  return NextResponse.json({
    rows: preview,
    counts,
    epicsCreated: newEpicNames.size,
    workLogsCreated: docsToInsert.length,
  });
}
