import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { users } from "../../../src/core/db/schema";
import { hashPassword } from "../../../src/modules/account/infrastructure/passwordHasher";
import { E2E_MANAGER_PASSWORD, E2E_MANAGER_PHONE } from "./e2e-db";
import { startE2ePostgres } from "./testcontainer";

export default async function globalSetup(): Promise<void> {
  const url = await startE2ePostgres();

  const client = postgres(url, { max: 1 });
  try {
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "./src/core/db/migrations" });

    await db.insert(users).values({
      name: "E2E 매니저",
      phoneNumber: E2E_MANAGER_PHONE,
      password: await hashPassword(E2E_MANAGER_PASSWORD),
      role: "MANAGER",
      color: "#2563eb",
      mustChangePassword: false,
    });
  } finally {
    await client.end();
  }
}
