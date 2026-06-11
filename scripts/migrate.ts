import "dotenv/config";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) throw new Error("TURSO_DATABASE_URL is not set");
  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  const db = drizzle(client);
  console.log(`Running migrations against ${url.replace(/\/\/.*@/, "//***@")} …`);
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("✓ Migrations applied");
  client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
