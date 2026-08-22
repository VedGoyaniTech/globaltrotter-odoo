import { execSync } from 'node:child_process';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://globetrotter:globetrotter@localhost:5432/globetrotter_test?schema=public';

/**
 * Applies the committed migrations to the test database once per run.
 * `migrate deploy` is non-destructive and creates the database if it is missing;
 * per-test isolation comes from the TRUNCATE in tests/setup.ts.
 */
export default function setup() {
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
