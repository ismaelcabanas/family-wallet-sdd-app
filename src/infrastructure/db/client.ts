import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "./schema";

function resolveDatabaseUrl(): string {
  return process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./db.sqlite";
}

function createDb() {
  const client = createClient({
    url: resolveDatabaseUrl(),
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  return drizzle(client, { schema });
}

type Database = ReturnType<typeof createDb>;

const globalForDb = globalThis as unknown as { __familyWalletDb?: Database };

export const db: Database = globalForDb.__familyWalletDb ?? createDb();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__familyWalletDb = db;
}
