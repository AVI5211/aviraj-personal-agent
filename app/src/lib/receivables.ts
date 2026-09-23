import { ObjectId } from "mongodb";
import type { ReceivableApi, ReceivableStatus } from "@/lib/types";

export interface ReceivableDoc {
  _id: ObjectId;
  personName: string;
  amountPaise: number;
  givenDate: string;
  expectedReturnDate: string | null;
  status: ReceivableStatus;
  returnedDate: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function serializeReceivable(doc: ReceivableDoc): ReceivableApi {
  return { id: doc._id.toString(), personName: doc.personName, amountPaise: doc.amountPaise, givenDate: doc.givenDate, expectedReturnDate: doc.expectedReturnDate, status: doc.status, returnedDate: doc.returnedDate, createdAt: doc.createdAt.toISOString() };
}
