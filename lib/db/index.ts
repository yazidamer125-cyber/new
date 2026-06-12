import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { __wakilproDb?: ReturnType<typeof buildDb> };

function buildDb() {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) throw new Error("TURSO_DATABASE_URL is not set");
  const client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  return drizzle(client, { schema });
}

// Reuse the client across hot reloads / lambda invocations.
export const db = globalForDb.__wakilproDb ?? buildDb();
if (process.env.NODE_ENV !== "production") globalForDb.__wakilproDb = db;

export * as tables from "./schema";
