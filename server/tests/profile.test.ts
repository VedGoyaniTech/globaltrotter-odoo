import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { api, makeTrip, makeUser, PASSWORD } from './helpers.js';

const UPLOAD_DIR = path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? 'uploads');

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

// Smallest valid PNG - enough for multer's mimetype check and a real disk write.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

describe('signup with the registration-form fields', () => {
  it('accepts firstName + lastName and derives the display name', async () => {
    const res = await api().post('/api/auth/signup').send({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada.full@test.dev',
      password: PASSWORD,
      phone: '+91 98765 43210',
      bio: 'Counting cities.',
      city: 'Surat',
      country: 'India',
    });

    expect(res.status).toBe(201);
    expect(res.body.user.name).toBe('Ada Lovelace');
    expect(res.body.user.firstName).toBe('Ada');
    expect(res.body.user.phone).toBe('+91 98765 43210');
    expect(res.body.user.bio).toBe('Counting cities.');
  });

  it('still accepts a single display name', async () => {
    const res = await api()
      .post('/api/auth/signup')
      .send({ name: 'Solo Name', email: 'solo@test.dev', password: PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body.user.name).toBe('Solo Name');
    expect(res.body.user.firstName).toBeNull();
  });

  it('rejects a lastName without a firstName and no display name', async () => {
    const res = await api()
      .post('/api/auth/signup')
      .send({ lastName: 'Lovelace', email: 'half@test.dev', password: PASSWORD });

    expect(res.status).toBe(400);
    expect(res.body.details.body[0].path).toBe('name');
  });

  it('rejects a malformed phone number', async () => {
    const res = await api().post('/api/auth/signup').send({
      name: 'Phone Person',
      email: 'phone@test.dev',
      password: PASSWORD,
      phone: 'call-me',
    });

    expect(res.status).toBe(400);
    expect(res.body.details.body[0].path).toBe('phone');
  });
});

describe('PATCH /api/users/me', () => {
  it('updates the new profile fields', async () => {
    const { token } = await makeUser();
    const res = await api()
      .patch('/api/users/me')
      .set(auth(token))
      .send({ firstName: 'Grace', lastName: 'Hopper', phone: '+1 555 0100', bio: 'Debugging.' });

    expect(res.status).toBe(200);
    expect(res.body.lastName).toBe('Hopper');
    expect(res.body.bio).toBe('Debugging.');
  });

  it('clears a field when sent null', async () => {
    const { token } = await makeUser();
    await api().patch('/api/users/me').set(auth(token)).send({ bio: 'temporary' });

    const res = await api().patch('/api/users/me').set(auth(token)).send({ bio: null });
    expect(res.body.bio).toBeNull();
  });
});

describe('POST /api/users/me/avatar', () => {
  it('stores the image and returns the served URL', async () => {
    const { token } = await makeUser();
    const res = await api()
      .post('/api/users/me/avatar')
      .set(auth(token))
      .attach('image', PNG, { filename: 'me.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    expect(res.body.avatarUrl).toMatch(/^\/uploads\/[0-9a-f]{32}\.png$/);

    // The stored name is generated, never the client's filename.
    expect(res.body.avatarUrl).not.toContain('me.png');
  });

  it('serves the stored file back over /uploads', async () => {
    const { token } = await makeUser();
    const upload = await api()
      .post('/api/users/me/avatar')
      .set(auth(token))
      .attach('image', PNG, { filename: 'a.png', contentType: 'image/png' });

    const fetched = await api().get(upload.body.avatarUrl);
    expect(fetched.status).toBe(200);
    expect(fetched.headers['content-type']).toContain('image/png');
  });

  it('rejects a non-image upload', async () => {
    const { token } = await makeUser();
    const res = await api()
      .post('/api/users/me/avatar')
      .set(auth(token))
      .attach('image', Buffer.from('#!/bin/sh\nrm -rf /'), {
        filename: 'evil.sh',
        contentType: 'application/x-sh',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('JPEG, PNG and WebP');
  });

  it('rejects a request with no file', async () => {
    const { token } = await makeUser();
    const res = await api().post('/api/users/me/avatar').set(auth(token));
    expect(res.status).toBe(400);
  });

  it('requires authentication', async () => {
    const res = await api()
      .post('/api/users/me/avatar')
      .attach('image', PNG, { filename: 'a.png', contentType: 'image/png' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/trips/:id/cover', () => {
  it('sets the cover photo on the caller own trip', async () => {
    const { user, token } = await makeUser();
    const trip = await makeTrip(user.id);

    const res = await api()
      .post(`/api/trips/${trip.id}/cover`)
      .set(auth(token))
      .attach('image', PNG, { filename: 'cover.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    expect(res.body.coverPhotoUrl).toMatch(/^\/uploads\//);
  });

  it('will not set a cover on someone else trip, and stores nothing', async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    const trip = await makeTrip(owner.user.id);

    const before = fs.existsSync(UPLOAD_DIR) ? fs.readdirSync(UPLOAD_DIR).length : 0;

    const res = await api()
      .post(`/api/trips/${trip.id}/cover`)
      .set(auth(stranger.token))
      .attach('image', PNG, { filename: 'cover.png', contentType: 'image/png' });

    expect(res.status).toBe(403);
    // The rejected upload must not have left a file behind.
    const after = fs.existsSync(UPLOAD_DIR) ? fs.readdirSync(UPLOAD_DIR).length : 0;
    expect(after).toBe(before);
  });
});
