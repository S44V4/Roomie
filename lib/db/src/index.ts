import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Use Neon's *pooled* connection string (hostname contains "-pooler") via the
// DATABASE_URL env var.  SSL is required by Neon; the flag is safely ignored
// by plain local Postgres.  Cap max connections conservatively — in serverless
// each Lambda instance runs its own pool, so keeping it small prevents
// exhausting Neon's connection limit across concurrent invocations.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("neon.tech")
    ? { rejectUnauthorized: false }
    : undefined,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});
export const db = drizzle(pool, { schema });

export * from "./schema";

