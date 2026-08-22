import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { api, makeTrip, makeUser } from './helpers.js';

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const SECRET = process.env.JWT_SECRET!;

describe('token handling', () => {
  it('rejects an alg=none token claiming ADMIN', async () => {
    const forged = jwt.sign({ sub: 'anyone', role: 'ADMIN' }, '', { algorithm: 'none' });
    expect((await api().get('/api/admin/stats').set(auth(forged))).status).toBe(401);
  });

  it('rejects a token whose payload was edited but signature kept', async () => {
    const { token } = await makeUser();
    const [header, , signature] = token.split('.');
    const tampered = Buffer.from(JSON.stringify({ sub: 'x', role: 'ADMIN' })).toString('base64url');
    const res = await api()
      .get('/api/admin/stats')
      .set(auth(`${header}.${tampered}.${signature}`));
    expect(res.status).toBe(401);
  });

  it('rejects a token signed with a different secret', async () => {
    const other = jwt.sign({ sub: 'x', role: 'ADMIN' }, 'a-different-secret-entirely', {
      algorithm: 'HS256',
    });
    expect((await api().get('/api/admin/stats').set(auth(other))).status).toBe(401);
  });

  it('ignores a token cookie — Bearer only', async () => {
    const { token } = await makeUser();
    const res = await api().get('/api/auth/me').set('Cookie', `token=${token}`);
    // Cookie auth would reopen a CSRF vector, so it must not authenticate.
    expect(res.status).toBe(401);
  });

  it('accepts the same token as a Bearer header', async () => {
    const { token } = await makeUser();
    expect((await api().get('/api/auth/me').set(auth(token))).status).toBe(200);
  });

  it('rejects an expired token', async () => {
    const { user } = await makeUser();
    const expired = jwt.sign({ sub: user.id, role: 'USER' }, SECRET, {
      algorithm: 'HS256',
      expiresIn: '-1s',
    });
    expect((await api().get('/api/auth/me').set(auth(expired))).status).toBe(401);
  });
});

describe('stored URL fields', () => {
  const dangerous = [
    'javascript:alert(document.cookie)',
    'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
    'file:///etc/passwd',
    'vbscript:msgbox(1)',
  ];

  it.each(dangerous)('refuses %s as an avatar', async (url) => {
    const { token } = await makeUser();
    const res = await api().patch('/api/users/me').set(auth(token)).send({ avatarUrl: url });
    expect(res.status).toBe(400);
  });

  it('refuses a dangerous scheme as a trip cover', async () => {
    const { user, token } = await makeUser();
    const trip = await makeTrip(user.id);
    const res = await api()
      .patch(`/api/trips/${trip.id}`)
      .set(auth(token))
      .send({ coverPhotoUrl: 'javascript:alert(1)' });
    expect(res.status).toBe(400);
  });

  it('still accepts ordinary https URLs', async () => {
    const { token } = await makeUser();
    const res = await api()
      .patch('/api/users/me')
      .set(auth(token))
      .send({ avatarUrl: 'https://example.com/me.png' });
    expect(res.status).toBe(200);
    expect(res.body.avatarUrl).toBe('https://example.com/me.png');
  });
});

describe('privilege boundaries', () => {
  it('cannot escalate role through the profile endpoint', async () => {
    const { token } = await makeUser();
    await api().patch('/api/users/me').set(auth(token)).send({ role: 'ADMIN' }).expect(200);
    expect((await api().get('/api/auth/me').set(auth(token))).body.role).toBe('USER');
    expect((await api().get('/api/admin/stats').set(auth(token))).status).toBe(403);
  });

  it('cannot reassign a trip to another user through PATCH', async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    const trip = await makeTrip(owner.user.id);

    await api()
      .patch(`/api/trips/${trip.id}`)
      .set(auth(owner.token))
      .send({ userId: stranger.user.id, name: 'Renamed' })
      .expect(200);

    // The unknown key is stripped, so ownership is unchanged.
    expect((await api().get(`/api/trips/${trip.id}`).set(auth(owner.token))).status).toBe(200);
    expect((await api().get(`/api/trips/${trip.id}`).set(auth(stranger.token))).status).toBe(403);
  });
});

describe('malformed input', () => {
  it('answers 400, not 500, for unparseable JSON', async () => {
    const res = await api()
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('valid JSON');
  });
});
