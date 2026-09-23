import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/mongodb";
import { ensureSeeded } from "@/lib/seed";
import { getSession } from "@/lib/session";
import { loginSchema } from "@/lib/validation";

interface UserDoc {
  _id: unknown;
  username: string;
  passwordHash: string;
}

export async function POST(request: NextRequest) {
  await ensureSeeded();

  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });
  }

  const db = await getDb();
  const user = await db.collection<UserDoc>("users").findOne({ username: parsed.data.username });

  if (!user) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  const passwordMatches = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!passwordMatches) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  const session = await getSession();
  session.userId = String(user._id);
  session.username = user.username;
  await session.save();

  return NextResponse.json({ username: user.username });
}
