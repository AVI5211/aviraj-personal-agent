import { ObjectId } from "mongodb";
import type { AccountApi, AccountType } from "@/lib/types";

export interface AccountDoc {
  _id: ObjectId;
  name: string;
  type: AccountType;
  balancePaise: number;
  createdAt: Date;
  updatedAt: Date;
}

export const LIABILITY_TYPES: readonly AccountType[] = ["loan"];

export function isLiability(type: AccountType): boolean {
  return LIABILITY_TYPES.includes(type);
}

export function serializeAccount(doc: AccountDoc): AccountApi {
  return {
    id: doc._id.toString(),
    name: doc.name,
    type: doc.type,
    balancePaise: doc.balancePaise,
    updatedAt: doc.updatedAt.toISOString(),
  };
}
