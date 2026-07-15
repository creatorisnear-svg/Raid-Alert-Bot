import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Managed Postgres providers (Neon, Supabase, Koyeb's Postgres add-on, etc.)
// require TLS and reject plain connections. Local/dev databases (e.g. this
// workspace's Replit Postgres) don't present a certificate at all, so only
// enable SSL when the connection string doesn't already opt out and doesn't
// look like a local/loopback host.
const connectionString = process.env.DATABASE_URL;
const isLocalHost = /localhost|127\.0\.0\.1|(^|@)helium(:|\/)/.test(connectionString);
const sslModeDisabled = /sslmode=disable/i.test(connectionString);
const ssl = !isLocalHost && !sslModeDisabled ? { rejectUnauthorized: false } : undefined;

export const pool = new Pool({ connectionString, ssl });
export const db = drizzle(pool, { schema });

export * from "./schema";
