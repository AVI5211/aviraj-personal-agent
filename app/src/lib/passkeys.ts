import { ObjectId } from "mongodb";

export interface PasskeyDoc {
  _id?: ObjectId;
  userId: ObjectId;
  credentialID: string;
  publicKey: Buffer;
  counter: number;
  transports?: string[];
  createdAt: Date;
  lastUsedAt?: Date;
}

export function requestOrigin(request: Request): { origin: string; rpID: string } {
  const url = new URL(request.url);
  return { origin: url.origin, rpID: url.hostname };
}
