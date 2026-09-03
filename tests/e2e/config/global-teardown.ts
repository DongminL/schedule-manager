import { stopE2ePostgres } from "./testcontainer";

export default async function globalTeardown(): Promise<void> {
  await stopE2ePostgres();
}
