import { beforeEach, describe, expect, it } from 'vitest';
import { api, makeUser, PASSWORD } from './helpers.js';
import { prisma } from '../src/lib/prisma.js';
import { outbox } from '../src/lib/mailer.js';

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

beforeEach(() => {
  outbox.length = 0;
});

describe('PATCH /api/users/me/password', () => {
  it('changes the password when the current one is correct', async () => {
    const { user, token } = await makeUser({ email: 'pw@test.dev' });

    const res = await api()
      .patch('/api/users/me/password')
      .set(auth(token))
      .send({ currentPassword: PASSWORD, newPassword: 'BrandNewPass1' });

    expect(res.status).toBe(200);

    // The new password works and the old one does not.
    await api()
      .post('/api/auth/login')
      .send({ email: user.email, password: 'BrandNewPass1' })
      .expect(200);
    await api().post('/api/auth/login').send({ email: user.email, password: PASSWORD }).expect(401);
  });

  it('refuses without the correct current password', async () => {
    const { user, token } = await makeUser();

    const res = await api()
      .patch('/api/users/me/password')
      .set(auth(token))
      .send({ currentPassword: 'NotIt12345', newPassword: 'BrandNewPass1' });

    expect(res.status).toBe(401);
    await api().post('/api/auth/login').send({ email: user.email, password: PASSWORD }).expect(200);
  });

  it('rejects a new password identical to the current one', async () => {
    const { token } = await makeUser();
    const res = await api()
      .patch('/api/users/me/password')
      .set(auth(token))
      .send({ currentPassword: PASSWORD, newPassword: PASSWORD });

    expect(res.status).toBe(400);
    expect(res.body.details.body[0].path).toBe('newPassword');
  });

  it('rejects a short new password', async () => {
    const { token } = await makeUser();
    const res = await api()
      .patch('/api/users/me/password')
      .set(auth(token))
      .send({ currentPassword: PASSWORD, newPassword: 'short' });

    expect(res.status).toBe(400);
  });

  it('invalidates outstanding reset links', async () => {
    const { user, token } = await makeUser({ email: 'pw-reset@test.dev' });
    await api().post('/api/auth/forgot-password').send({ email: user.email });
    expect(await prisma.passwordResetToken.count({ where: { userId: user.id } })).toBe(1);

    await api()
      .patch('/api/users/me/password')
      .set(auth(token))
      .send({ currentPassword: PASSWORD, newPassword: 'BrandNewPass1' })
      .expect(200);

    expect(await prisma.passwordResetToken.count({ where: { userId: user.id } })).toBe(0);
  });

  it('requires authentication', async () => {
    const res = await api()
      .patch('/api/users/me/password')
      .send({ currentPassword: PASSWORD, newPassword: 'BrandNewPass1' });
    expect(res.status).toBe(401);
  });
});

describe('password reset email', () => {
  it('sends a mail carrying a link that actually works', async () => {
    const { user } = await makeUser({ email: 'mailer@test.dev' });

    await api().post('/api/auth/forgot-password').send({ email: user.email }).expect(200);

    expect(outbox).toHaveLength(1);
    expect(outbox[0].to).toBe('mailer@test.dev');
    expect(outbox[0].subject).toContain('Reset your GlobeTrotter password');

    // Pull the token out of the email exactly as a recipient would.
    const link = outbox[0].text.match(/http\S+reset-password\?token=([a-f0-9]+)/);
    expect(link).not.toBeNull();

    await api()
      .post('/api/auth/reset-password')
      .send({ token: link![1], password: 'FromTheEmail1' })
      .expect(200);
    await api()
      .post('/api/auth/login')
      .send({ email: user.email, password: 'FromTheEmail1' })
      .expect(200);
  });

  it('sends nothing for an unknown address but still answers 200', async () => {
    const res = await api().post('/api/auth/forgot-password').send({ email: 'ghost@test.dev' });

    expect(res.status).toBe(200);
    expect(outbox).toHaveLength(0);
    // The response must not differ from the registered case.
    expect(res.body.message).toContain('If that email is registered');
  });

  it('does not leak the token in the response body', async () => {
    const { user } = await makeUser({ email: 'noleak@test.dev' });
    const res = await api().post('/api/auth/forgot-password').send({ email: user.email });

    // MAIL_TRANSPORT is not "log" here, so the dev escape hatch stays closed.
    expect(res.body.devResetToken).toBeUndefined();
  });
});

describe('GET /api/health/ready', () => {
  it('reports the database as reachable', async () => {
    const res = await api().get('/api/health/ready');

    expect(res.status).toBe(200);
    expect(res.body.database).toBe('reachable');
    expect(res.body.latencyMs).toBeTypeOf('number');
  });

  it('liveness stays shallow and does not touch the database', async () => {
    const res = await api().get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.database).toBeUndefined();
  });
});
