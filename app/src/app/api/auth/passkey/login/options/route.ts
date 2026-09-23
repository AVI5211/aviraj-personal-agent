import { NextRequest, NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { getDb } from "@/lib/mongodb";
import { requestOrigin, type PasskeyDoc } from "@/lib/passkeys";
import { getSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  const { origin, rpID } = requestOrigin(request);
  const passkeys = await getDb().then((db) => db.collection<PasskeyDoc>("passkeys").find().toArray());
  if (!passkeys.length) return NextResponse.json({ error: "No fingerprint unlock is set up yet. Sign in with your password first." }, { status: 404 });
  const options = await generateAuthenticationOptions({ rpID, userVerification: "required", allowCredentials: passkeys.map((key) => ({ id: key.credentialID, transports: key.transports as AuthenticatorTransport[] | undefined })) });
  const session = await getSession(); session.passkeyChallenge = options.challenge; session.passkeyRpId = rpID; session.passkeyOrigin = origin; await session.save();
  return NextResponse.json(options);
}
