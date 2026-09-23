import { MongoClient, type Db } from "mongodb";
import { getEnv } from "@/lib/env";

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function getClientPromise(): Promise<MongoClient> {
  if (!global._mongoClientPromise) {
    const client = new MongoClient(getEnv().mongodbUri);
    global._mongoClientPromise = client.connect();
  }
  return global._mongoClientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise();
  return client.db(getEnv().mongodbDb);
}

let indexesEnsured = false;

export async function ensureIndexes(): Promise<void> {
  if (indexesEnsured) return;
  const db = await getDb();

  await db.collection("users").createIndex({ username: 1 }, { unique: true });

  await db.collection("transactions").createIndex({ module: 1, transactionDate: 1 });
  await db.collection("transactions").createIndex({ module: 1, type: 1, transactionDate: 1 });
  await db.collection("transactions").createIndex({ paymentMethod: 1 });
  await db.collection("transactions").createIndex({ category: 1 });

  await db.collection("accounts").createIndex({ type: 1 });
  await db.collection("salary_records").createIndex({ month: 1 }, { unique: true });

  await db.collection("investments").createIndex({ holdingType: 1, name: 1 });
  await db.collection("investment_valuations").createIndex({ investmentId: 1, valuationDate: 1 });

  await db.collection("loans").createIndex({ status: 1 });
  await db.collection("loan_payments").createIndex({ loanId: 1, dueDate: 1 });
  await db.collection("loan_payments").createIndex({ loanId: 1, status: 1 });
  await db.collection("recurring_expenses").createIndex({ dueDayOfMonth: 1, name: 1 });
  await db.collection("clients").createIndex({ name: 1 });
  await db.collection("epics").createIndex({ clientId: 1 });
  await db.collection("work_logs").createIndex({ clientId: 1, invoiced: 1 });
  await db.collection("work_logs").createIndex({ date: 1 });
  await db.collection("invoices").createIndex({ clientId: 1, status: 1 });
  await db.collection("invoices").createIndex({ issueDate: 1 });
  await db.collection("lead_expenses").createIndex({ date: 1 });

  indexesEnsured = true;
}
