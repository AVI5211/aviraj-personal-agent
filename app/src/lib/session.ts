import { cookies } from "next/headers";
import { getIronSession, type IronSession, type SessionOptions } from "iron-session";
import { getEnv } from "@/lib/env";

export interface SessionData {
  userId?: string;
  username?: string;
  passkeyChallenge?: string;
  passkeyRpId?: string;
  passkeyOrigin?: string;
}

export function getSessionOptions(): SessionOptions {
  return {
    password: getEnv().sessionSecret,
    cookieName: "shop_hisab_session",
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      // The app is served over plain HTTP by default (localhost-only bind, or a reverse
      // proxy that terminates TLS in front of it). Only mark the cookie Secure when an
      // operator has confirmed the app itself is reachable over HTTPS.
      secure: process.env.COOKIE_SECURE === "true",
      maxAge: 60 * 60 * 24 * 30,
    },
  };
}

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, getSessionOptions());
}
