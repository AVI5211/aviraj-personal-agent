import { NextRequest, NextResponse } from "next/server";
import { verifyAuthenticationResponse, type AuthenticationResponseJSON } from "@simplewebauthn/server";
import { getDb } from "@/lib/mongodb";
import { publicKeyBytes, type PasskeyDoc } from "@/lib/passkeys";
import { getSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.passkeyChallenge || !session.passkeyRpId || !session.passkeyOrigin) return NextResponse.json({ error: "Fingerprint request expired. Try again." }, { status: 400 });
  const response = (await request.json().catch(() => null)) as AuthenticationResponseJSON | null;
  if (!response) return NextResponse.json({ error: "Invalid passkey response" }, { status: 400 });
  const db = await getDb(); const passkey = await db.collection<PasskeyDoc>("passkeys").findOne({ credentialID: response.id });
  if (!passkey) return NextResponse.json({ error: "This fingerprint is not registered" }, { status: 401 });
  try {
    const verification = await verifyAuthenticationResponse({ response, expectedChallenge: session.passkeyChallenge, expectedOrigin: session.passkeyOrigin, expectedRPID: session.passkeyRpId, credential: { id: passkey.credentialID, publicKey: publicKeyBytes(passkey.publicKey), counter: passkey.counter, transports: passkey.transports as AuthenticatorTransport[] | undefined }, requireUserVerification: true });
    if (!verification.verified) return NextResponse.json({ error: "Fingerprint could not be verified" }, { status: 401 });
    await db.collection<PasskeyDoc>("passkeys").updateOne({ _id: passkey._id }, { $set: { counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date() } });
    const user = await db.collection<{ username: string }>("users").findOne({ _id: passkey.userId });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 401 });
    session.userId = passkey.userId.toString(); session.username = user.username; delete session.passkeyChallenge; delete session.passkeyRpId; delete session.passkeyOrigin; await session.save();
    return NextResponse.json({ username: user.username });
  } catch (error) { console.error("Passkey authentication verification failed", error); return NextResponse.json({ error: "Fingerprint verification failed" }, { status: 401 }); }
}
