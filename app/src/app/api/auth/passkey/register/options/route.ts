import { NextRequest, NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { getDb } from "@/lib/mongodb";
import { requestOrigin, type PasskeyDoc } from "@/lib/passkeys";
import { getSession } from "@/lib/session";
import { ObjectId } from "mongodb";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId || !ObjectId.isValid(session.userId)) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const db = await getDb();
  const userId = new ObjectId(session.userId);
  const user = await db.collection<{ username: string }>("users").findOne({ _id: userId });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  const { origin, rpID } = requestOrigin(request);
  const passkeys = await db.collection<PasskeyDoc>("passkeys").find({ userId }).toArray();
  const options = await generateRegistrationOptions({
    rpName: "Aviraj Money Desk", rpID, userID: new TextEncoder().encode(userId.toString()), userName: user.username,
    attestationType: "none", excludeCredentials: passkeys.map((key) => ({ id: key.credentialID, transports: key.transports as AuthenticatorTransport[] | undefined })),
    authenticatorSelection: { authenticatorAttachment: "platform", residentKey: "required", userVerification: "required" },
    supportedAlgorithmIDs: [-7, -257],
  });
  session.passkeyChallenge = options.challenge; session.passkeyRpId = rpID; session.passkeyOrigin = origin; await session.save();
  return NextResponse.json(options);
}
