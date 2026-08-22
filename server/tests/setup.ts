import { afterAll, beforeEach } from 'vitest';
import { prisma } from '../src/lib/prisma.js';

/** Truncating between tests keeps each case independent without re-migrating. */
beforeEach(async () => {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "TripActivity", "TripStop", "Expense", "Trip",
      "SavedDestination", "PasswordResetToken", "Activity", "City", "User"
    RESTART IDENTITY CASCADE;
  `);
});

afterAll(async () => {
  await prisma.$disconnect();
});
