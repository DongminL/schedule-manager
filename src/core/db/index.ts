import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

type Database = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  __pgClient?: ReturnType<typeof postgres>;
  __db?: Database;
};

function init(): Database {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const isProd = process.env.NODE_ENV === "production";
  const client =
    globalForDb.__pgClient ??
    postgres(connectionString, {
      max: isProd ? 1 : 5,
      prepare: false,
      idle_timeout: 20,
      connect_timeout: 10,
    });
  if (!isProd) globalForDb.__pgClient = client;
  return drizzle(client, { schema });
}

/** Lazily-initialised drizzle client. */
export const db: Database = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    globalForDb.__db ??= init();
    return Reflect.get(globalForDb.__db, prop, receiver);
  },
});

export { schema };
export type DB = Database;
/** A drizzle transaction handle. */
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
/** Anything that can run queries: the pool or an open transaction. */
export type Exec = DB | Tx;
