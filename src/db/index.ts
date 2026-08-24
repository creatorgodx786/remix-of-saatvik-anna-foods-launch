import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { getConnectionString } from "@netlify/database";
import * as schema from "./schema";

const { Pool } = pg;

let pool: pg.Pool | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;
let activeConnectionString: string | null = null;

export function getDb() {
  let connectionString = "";
  try {
    connectionString = getConnectionString();
  } catch {
    const netlifyEnv = (globalThis as any).Netlify?.env;
    connectionString =
      (typeof netlifyEnv?.get === "function" && netlifyEnv.get("NETLIFY_DB_URL")) ||
      process.env["NETLIFY_DB_URL"] ||
      (typeof netlifyEnv?.get === "function" && netlifyEnv.get("NETLIFY_DATABASE_URL")) ||
      process.env["NETLIFY_DATABASE_URL"] ||
      (typeof netlifyEnv?.get === "function" && netlifyEnv.get("DATABASE_URL")) ||
      process.env["DATABASE_URL"] ||
      "";
  }

  if (dbInstance && activeConnectionString === connectionString && connectionString !== "") {
    return dbInstance;
  }

  if (!connectionString) {
    console.warn("NETLIFY_DATABASE_URL or DATABASE_URL is not set.");
  }

  activeConnectionString = connectionString;
  pool = new Pool({
    connectionString: connectionString || undefined,
    ssl: connectionString && !connectionString.includes("localhost") && !connectionString.includes("127.0.0.1")
      ? { rejectUnauthorized: false }
      : false,
    max: 10,
    idleTimeoutMillis: 30000,
  });

  dbInstance = drizzle(pool, { schema });
  return dbInstance;
}

export const db = getDb();
export * from "./schema";
