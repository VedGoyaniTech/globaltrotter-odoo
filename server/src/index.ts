import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { warnIfMailMisconfigured } from './lib/mailer.js';

warnIfMailMisconfigured();

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`GlobeTrotter API listening on http://localhost:${env.PORT}/api`);
});

const shutdown = async (signal: string) => {
  console.log(`\n${signal} received, shutting down.`);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
