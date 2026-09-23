import { Binary, ObjectId } from "mongodb";

export interface PasskeyDoc {
  _id?: ObjectId;
  userId: ObjectId;
  credentialID: string;
  publicKey: Buffer | Binary;
  counter: number;
  transports?: string[];
  createdAt: Date;
  lastUsedAt?: Date;
}

export function publicKeyBytes(value: Buffer | Binary): Uint8Array<ArrayBuffer> {
  const bytes = value instanceof Binary ? value.value() : value;
  return new Uint8Array(Array.from(bytes));
}

export function requestOrigin(request: Request): { origin: string; rpID: string } {
  // Behind Cloud Run, request.url points at the container (0.0.0.0:8080).
  // WebAuthn must instead be bound to the browser-visible HTTPS hostname.
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0].trim();
  const host = (forwardedHost || request.headers.get("host") || new URL(request.url).host).replace(/:\d+$/, "");
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  return { origin: `${forwardedProto || "https"}://${host}`, rpID: host };
}
