import { describe, expect, it } from 'vitest';
import { api, makeUser, PASSWORD } from './helpers.js';
import { prisma } from '../src/lib/prisma.js';

describe('POST /api/auth/signup', () => {
  it('creates an account and returns a token', async () => {
    const res = await api()
      .post('/api/auth/signup')
      .send({ name: 'Ada Lovelace', email: 'Ada@Example.com', password: PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTypeOf('string');
    expect(res.body.user.email).toBe('ada@example.com'); // normalized
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('rejects a duplicate email with 409', async () => {
    await api()
      .post('/api/auth/signup')
      .send({ name: 'Alice', email: 'dupe@test.dev', password: PASSWORD });
    const res = await api()
      .post('/api/auth/signup')
      .send({ name: 'Bob', email: 'dupe@test.dev', password: PASSWORD });

    expect(res.status).toBe(409);
  });

  it('rejects a short password with 400 and field details', async () => {
    const res = await api()
      .post('/api/auth/signup')
      .send({ name: 'Ada', email: 'short@test.dev', password: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body.details.body[0].path).toBe('password');
  });
});

describe('POST /api/auth/login', () => {
  it('returns a token for valid credentials', async () => {
    const { user } = await makeUser({ email: 'login@test.dev' });
    const res = await api().post('/api/auth/login').send({ email: user.email, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(user.id);
  });

  it('gives the same 401 for a wrong password and an unknown email', async () => {
    await makeUser({ email: 'known@test.dev' });

    const wrongPassword = await api()
      .post('/api/auth/login')
      .send({ email: 'known@test.dev', password: 'WrongPassword1' });
    const unknownEmail = await api()
      .post('/api/auth/login')
      .send({ email: 'nobody@test.dev', password: PASSWORD });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error).toBe(unknownEmail.body.error);
  });
});

describe('GET /api/auth/me', () => {
  it('rejects an anonymous request', async () => {
    expect((await api().get('/api/auth/me')).status).toBe(401);
  });

  it('rejects a malformed token', async () => {
    const res = await api().get('/api/auth/me').set('Authorization', 'Bearer not-a-jwt');
    expect(res.status).toBe(401);
  });

  it('returns the current user', async () => {
    const { user, token } = await makeUser();
    const res = await api().get('/api/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(user.email);
  });
});

describe('password reset', () => {
  it('issues a single-use token that updates the password', async () => {
    const { user } = await makeUser({ email: 'reset@test.dev' });

    const forgot = await api().post('/api/auth/forgot-password').send({ email: user.email });
    expect(forgot.status).toBe(200);
    const token = forgot.body.devResetToken;
    expect(token).toBeTypeOf('string');

    const reset = await api()
      .post('/api/auth/reset-password')
      .send({ token, password: 'BrandNewPass1' });
    expect(reset.status).toBe(200);

    const login = await api()
      .post('/api/auth/login')
      .send({ email: user.email, password: 'BrandNewPass1' });
    expect(login.status).toBe(200);

    // The same token must not work twice.
    const replay = await api()
      .post('/api/auth/reset-password')
      .send({ token, password: 'AnotherPass1' });
    expect(replay.status).toBe(400);
  });

  it('does not reveal whether an email is registered', async () => {
    const res = await api().post('/api/auth/forgot-password').send({ email: 'ghost@test.dev' });
    expect(res.status).toBe(200);
    expect(res.body.devResetToken).toBeUndefined();
    expect(await prisma.passwordResetToken.count()).toBe(0);
  });

  it('rejects an expired token', async () => {
    const { user } = await makeUser({ email: 'expired@test.dev' });
    const forgot = await api().post('/api/auth/forgot-password').send({ email: user.email });

    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await api()
      .post('/api/auth/reset-password')
      .send({ token: forgot.body.devResetToken, password: 'BrandNewPass1' });
    expect(res.status).toBe(400);
  });
});
