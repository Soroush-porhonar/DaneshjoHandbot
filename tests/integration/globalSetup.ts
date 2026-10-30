/**
 * Runs once before the integration tests: creates the test database if it is
 * missing and applies all migrations to it (so migrations are tested too).
 */
import { execSync } from "node:child_process";
import pg from "pg";

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://botuser:postgres@127.0.0.1:5433/daneshjohandbot_test";

export default async function setup(): Promise<void> {
  const url = new URL(TEST_DATABASE_URL);
  const database = url.pathname.slice(1);

  // The tests empty every table, so never let them touch a real database.
  if (!database.endsWith("_test")) {
    throw new Error(`Refusing to run integration tests on "${database}" (name must end with _test)`);
  }

  const admin = new URL(TEST_DATABASE_URL);
  admin.pathname = "/postgres";
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();

  try {
    const exists = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [database]);
    if (exists.rowCount === 0) {
      await client.query(`CREATE DATABASE "${database}"`);
    }
  } finally {
    await client.end();
  }

  execSync("npx node-pg-migrate up", {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "ignore",
  });
}
