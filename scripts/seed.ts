import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { loadEnv } from "../src/core/db/load-env";
import { users } from "../src/core/db/schema";
import { hashPassword } from "../src/modules/account/infrastructure/passwordHasher";

loadEnv();

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const name = process.env.SEED_MANAGER_NAME ?? "점장";
const phone = process.env.SEED_MANAGER_PHONE;
const password = process.env.SEED_MANAGER_PASSWORD ?? phone;
if (!phone) throw new Error("SEED_MANAGER_PHONE is not set");

async function main(): Promise<void> {
  const sql = postgres(url as string, { max: 1 });
  const db = drizzle(sql);

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.phoneNumber, phone as string))
    .limit(1);

  if (existing) {
     
    console.log(`manager already exists (id=${existing.id}), skipping`);
  } else {
    const [row] = await db
      .insert(users)
      .values({
        name,
        phoneNumber: phone as string,
        password: await hashPassword(password!),
        role: "MANAGER",
        color: "#2563eb",
        // Manager must also change the seeded password on first login.
        mustChangePassword: true,
      })
      .returning();
     
    console.log(`seeded manager id=${row!.id} phone=${phone}`);
  }

  await sql.end();
}

main().catch((err: unknown) => {
   
  console.error(err);
  process.exit(1);
});
