import { NextRequest, NextResponse } from "next/server";
import { verifyRegistrationResponse, type RegistrationResponseJSON } from "@simplewebauthn/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { type PasskeyDoc } from "@/lib/passkeys";
import { getSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId || !session.passkeyChallenge || !session.passkeyRpId || !session.passkeyOrigin || !ObjectId.isValid(session.userId)) return NextResponse.json({ error: "Passkey setup expired. Try again." }, { status: 400 });
  const response = (await request.json().catch(() => null)) as RegistrationResponseJSON | null;
  if (!response) return NextResponse.json({ error: "Invalid passkey response" }, { status: 400 });
  try {
    const verification = await verifyRegistrationResponse({ response, expectedChallenge: session.passkeyChallenge, expectedOrigin: session.passkeyOrigin, expectedRPID: session.passkeyRpId, requireUserVerification: true, supportedAlgorithmIDs: [-7, -257] });
    if (!verification.verified || !verification.registrationInfo) return NextResponse.json({ error: "Passkey could not be verified" }, { status: 400 });
    const credential = verification.registrationInfo.credential;
    await getDb().then((db) => db.collection<PasskeyDoc>("passkeys").updateOne(
      { credentialID: credential.id },
      { $set: { userId: new ObjectId(session.userId), credentialID: credential.id, publicKey: Buffer.from(credential.publicKey), counter: credential.counter, transports: credential.transports, createdAt: new Date() } },
      { upsert: true },
    ));
    delete session.passkeyChallenge; delete session.passkeyRpId; delete session.passkeyOrigin; await session.save();
    return NextResponse.json({ verified: true });
  } catch { return NextResponse.json({ error: "Passkey verification failed" }, { status: 400 }); }
}
