import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { loadEnv } from "./load-env";

loadEnv();

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set");
}

async function main(): Promise<void> {
  const sql = postgres(url as string, { max: 1 });
  const db = drizzle(sql);

  await migrate(db, { migrationsFolder: "./src/core/db/migrations" });
  await sql.end();

  console.log("migrations applied");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
