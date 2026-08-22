import crypto from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { signToken } from '../../lib/jwt.js';
import type { LoginInput, SignupInput } from './auth.schema.js';

const publicUser = {
  id: true,
  name: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  bio: true,
  avatarUrl: true,
  city: true,
  country: true,
  language: true,
  role: true,
  createdAt: true,
} as const;

const RESET_TOKEN_TTL_MS = 1000 * 60 * 30; // 30 minutes

export async function signup(input: SignupInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw ApiError.conflict('An account with that email already exists');

  const user = await prisma.user.create({
    data: {
      name: input.name ?? `${input.firstName} ${input.lastName}`,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      phone: input.phone,
      bio: input.bio,
      city: input.city,
      country: input.country,
    },
    select: publicUser,
  });

  return { user, token: signToken({ sub: user.id, role: user.role }) };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  // Same message for both branches so the endpoint can't be used to enumerate emails.
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const { passwordHash: _omit, updatedAt: _updatedAt, ...safe } = user;
  return { user: safe, token: signToken({ sub: user.id, role: user.role }) };
}

export async function me(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: publicUser });
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

/**
 * Issues a single-use reset token. Only the hash is stored.
 * The raw token is returned so the caller can mail it; in dev we surface it directly
 * because there is no mail provider wired up yet.
 */
export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null; // do not reveal whether the account exists

  // Clear out this user's spent and expired tokens so the table cannot grow
  // unbounded from repeated reset requests.
  await prisma.passwordResetToken.deleteMany({
    where: {
      userId: user.id,
      OR: [{ usedAt: { not: null } }, { expiresAt: { lt: new Date() } }],
    },
  });

  const raw = crypto.randomBytes(32).toString('hex');
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: crypto.createHash('sha256').update(raw).digest('hex'),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });
  return raw;
}

export async function resetPassword(rawToken: string, newPassword: string) {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw ApiError.badRequest('Reset link is invalid or has expired');
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash: await hashPassword(newPassword) },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);
}
