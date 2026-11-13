import bcrypt from "bcryptjs";
import { getDb, ensureIndexes } from "@/lib/mongodb";
import { ensureOpeningBalanceSeeded } from "@/lib/settings";
import { getEnv } from "@/lib/env";
import { todayInShopTz } from "@/lib/dates";
import { DEFAULT_VEHICLES } from "@/lib/vehicles";

let seeded = false;

export async function ensureSeeded(): Promise<void> {
  if (seeded) return;
  await ensureIndexes();
  const db = await getDb();
  const env = getEnv();

  const existingAdmin = await db.collection<{ passwordHash: string }>("users").findOne({ username: env.adminUsername });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(env.adminPassword, 12);
    await db.collection("users").insertOne({
      username: env.adminUsername,
      passwordHash,
      createdAt: new Date(),
    });
  } else if (!(await bcrypt.compare(env.adminPassword, existingAdmin.passwordHash))) {
    // The environment secret is the source of truth. This keeps a deployment
    // usable after the configured administrator password is rotated.
    await db.collection("users").updateOne(
      { username: env.adminUsername },
      { $set: { passwordHash: await bcrypt.hash(env.adminPassword, 12), updatedAt: new Date() } }
    );
  }

  await ensureOpeningBalanceSeeded(env.openingBalancePaise);

  seeded = true;
}

let vehiclesSeeded = false;

/** Creates the Harrier EV and Hunter 350 once; tracking starts on the day they are created. */
export async function ensureVehiclesSeeded(): Promise<void> {
  if (vehiclesSeeded) return;
  await ensureSeeded();
  const db = await getDb();
  const now = new Date();
  for (const vehicle of DEFAULT_VEHICLES) {
    await db.collection("vehicles").updateOne(
      { seedKey: vehicle.seedKey },
      { $setOnInsert: { ...vehicle, trackingStartDate: todayInShopTz(now), createdAt: now, updatedAt: now } },
      { upsert: true }
    );
  }
  vehiclesSeeded = true;
}
