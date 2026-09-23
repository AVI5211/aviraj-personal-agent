import bcrypt from "bcryptjs";
import { getDb, ensureIndexes } from "@/lib/mongodb";
import { ensureOpeningBalanceSeeded } from "@/lib/settings";
import { getEnv } from "@/lib/env";

let seeded = false;

export async function ensureSeeded(): Promise<void> {
  if (seeded) return;
  await ensureIndexes();
  const db = await getDb();
  const env = getEnv();

  const existingAdmin = await db.collection("users").findOne({ username: env.adminUsername });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(env.adminPassword, 12);
    await db.collection("users").insertOne({
      username: env.adminUsername,
      passwordHash,
      createdAt: new Date(),
    });
  }

  await ensureOpeningBalanceSeeded(env.openingBalancePaise);

  seeded = true;
}
