import { getDb } from "@/lib/mongodb";

export interface SettingsDoc {
  _id: string;
  amountPaise: number;
  updatedAt: Date;
}

const OPENING_BALANCE_ID = "opening_balance";

export async function getOpeningBalancePaise(): Promise<number> {
  const db = await getDb();
  const doc = await db.collection<SettingsDoc>("settings").findOne({ _id: OPENING_BALANCE_ID });
  return doc?.amountPaise ?? 0;
}

export async function setOpeningBalancePaise(amountPaise: number): Promise<void> {
  const db = await getDb();
  await db.collection<SettingsDoc>("settings").updateOne(
    { _id: OPENING_BALANCE_ID },
    { $set: { amountPaise, updatedAt: new Date() } },
    { upsert: true }
  );
}

export async function ensureOpeningBalanceSeeded(defaultAmountPaise: number): Promise<void> {
  const db = await getDb();
  const existing = await db.collection<SettingsDoc>("settings").findOne({ _id: OPENING_BALANCE_ID });
  if (!existing) {
    await db.collection<SettingsDoc>("settings").insertOne({
      _id: OPENING_BALANCE_ID,
      amountPaise: defaultAmountPaise,
      updatedAt: new Date(),
    });
  }
}
