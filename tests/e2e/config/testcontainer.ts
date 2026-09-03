import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";

import { E2E_DB_IMAGE, E2E_DB_NAME, E2E_DB_PASSWORD, E2E_DB_PORT, E2E_DB_USER } from "./e2e-db";

const KEY = "__e2ePostgresContainer";
const store = globalThis as unknown as { [KEY]?: StartedPostgreSqlContainer };

/** 
 * Start a fresh Postgres bound to the fixed host port from `e2e-db.ts`.
 * Returns its connection URI (host port already mapped). 
 */
export async function startE2ePostgres(): Promise<string> {
  const container = await new PostgreSqlContainer(E2E_DB_IMAGE)
    .withUsername(E2E_DB_USER)
    .withPassword(E2E_DB_PASSWORD)
    .withDatabase(E2E_DB_NAME)
    .withExposedPorts({ container: 5432, host: E2E_DB_PORT })
    .start();
  store[KEY] = container;
  return container.getConnectionUri();
}

/** Stop and remove the container started by `startE2ePostgres()`, if any. */
export async function stopE2ePostgres(): Promise<void> {
  await store[KEY]?.stop();
  delete store[KEY];
}
