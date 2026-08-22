import { defineConfig } from 'vitest/config';

// Tests run against a dedicated database so they never touch dev data.
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://globetrotter:globetrotter@localhost:5432/globetrotter_test?schema=public';

export default defineConfig({
  test: {
    globalSetup: './tests/globalSetup.ts',
    setupFiles: ['./tests/setup.ts'],
    // Every file shares one database, so they must not run concurrently.
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DATABASE_URL,
      JWT_SECRET: 'test-secret-value-not-used-in-production',
      JWT_EXPIRES_IN: '1h',
      CLIENT_URL: 'http://localhost:5173',
      // Limiters are module-level singletons shared by every test file, so they
      // are raised here and exercised directly in tests/rateLimit.test.ts.
      AUTH_RATE_LIMIT_MAX: '100000',
      SIGNUP_RATE_LIMIT_MAX: '100000',
      RESET_RATE_LIMIT_MAX: '100000',
      UPLOAD_DIR: 'tests/.uploads',
    },
    include: ['tests/**/*.test.ts'],
  },
});
