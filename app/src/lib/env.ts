export interface Env {
  mongodbUri: string;
  mongodbDb: string;
  sessionSecret: string;
  adminUsername: string;
  adminPassword: string;
  openingBalancePaise: number;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

let cached: Env | null = null;

// SALARY_SPIKE=true swaps the Salary page for the V2 (salary slips) page; anything else
// keeps the original page. Read per request so flipping the env var needs no rebuild.
export function isSalarySpikeEnabled(): boolean {
  return (process.env.SALARY_SPIKE ?? "").trim().toLowerCase() === "true";
}

// Validated lazily (on first real use inside a request) rather than at module
// load time, so `next build` can statically analyze route modules without
// runtime secrets being present in the build environment.
export function getEnv(): Env {
  if (cached) return cached;

  const sessionSecret = required("SESSION_SECRET");
  const openingBalancePaise = Number(process.env.OPENING_BALANCE_PAISE ?? "0");

  if (sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters long");
  }
  if (!Number.isInteger(openingBalancePaise) || openingBalancePaise < 0) {
    throw new Error("OPENING_BALANCE_PAISE must be a non-negative integer");
  }

  cached = {
    mongodbUri: required("MONGODB_URI"),
    mongodbDb: required("MONGODB_DB"),
    sessionSecret,
    adminUsername: required("ADMIN_USERNAME"),
    adminPassword: required("ADMIN_PASSWORD"),
    openingBalancePaise,
  };
  return cached;
}
