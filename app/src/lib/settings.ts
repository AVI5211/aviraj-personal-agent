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

interface RateSettingsDoc {
  _id: string;
  rate: number;
  updatedAt: Date;
}

const FREELANCE_USD_INR_RATE_ID = "freelance_usd_inr_rate";
export const DEFAULT_USD_INR_RATE = 83;

// The last USD→INR rate the user entered — remembered so every new invoice or
// unbilled-work estimate defaults to it instead of asking again each time.
export async function getFreelanceUsdInrRate(): Promise<number> {
  const db = await getDb();
  const doc = await db.collection<RateSettingsDoc>("settings").findOne({ _id: FREELANCE_USD_INR_RATE_ID });
  return doc?.rate ?? DEFAULT_USD_INR_RATE;
}

export async function setFreelanceUsdInrRate(rate: number): Promise<void> {
  const db = await getDb();
  await db.collection<RateSettingsDoc>("settings").updateOne(
    { _id: FREELANCE_USD_INR_RATE_ID },
    { $set: { rate, updatedAt: new Date() } },
    { upsert: true }
  );
}
