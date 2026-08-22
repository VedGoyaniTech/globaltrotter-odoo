import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  // Failed login/signup attempts allowed per IP per 15 minutes.
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(20),
  // Accounts creatable per IP per hour.
  SIGNUP_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(10),
  // Password reset requests allowed per IP per hour.
  RESET_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(5),
  // Where uploaded avatars and cover photos are written.
  // Number of reverse proxies in front of the app. Rate limiting keys on the
  // client IP, so this must be right or every request looks like one address.
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
  // Public origin of the frontend, used to build links inside emails.
  APP_URL: z.string().url().default('http://localhost:5173'),
  // smtp = really send; log = print to stdout (local dev); memory = capture (tests).
  MAIL_TRANSPORT: z.enum(['smtp', 'log', 'memory']).default('log'),
  MAIL_FROM: z.string().default('GlobeTrotter <no-reply@globetrotter.app>'),
  SMTP_URL: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  UPLOAD_DIR: z.string().default('uploads'),
  MAX_UPLOAD_BYTES: z.coerce
    .number()
    .int()
    .min(1024)
    .default(5 * 1024 * 1024),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(
    `Invalid environment configuration:\n${issues}\n\nCopy server/.env.example to server/.env and fill it in.`,
  );
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
