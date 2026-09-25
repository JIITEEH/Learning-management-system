import './setup.js';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';
import { PASSWORD, makeUser, startApi } from './helpers.js';
import * as PasswordReset from '../src/database-queries/passwordResetModel.js';
import * as User from '../src/database-queries/userModel.js';

const api = await startApi();

describe('registering', () => {
  it('makes the very first account an active administrator', async () => {
    const res = await api.post('/auth/register', { body: { fullName: 'First Person', email: 'first@example.test', password: PASSWORD } });
    assert.equal(res.status, 201);
    assert.equal(res.data.user.role, 'admin');
    assert.equal(res.data.user.status, 'active');
  });

  it('makes every later account a student awaiting approval, whatever the request asks for', async () => {
    const res = await api.post('/auth/register', {
      body: { fullName: 'Sneaky', email: 'sneaky@example.test', password: PASSWORD, role: 'admin', status: 'active' },
    });
    assert.equal(res.status, 201);
    assert.equal(res.data.user.role, 'student');
    assert.equal(res.data.user.status, 'pending');
  });

  it('refuses an account awaiting approval at sign-in', async () => {
    assert.equal((await api.signIn('sneaky@example.test')).status, 403);
  });

  it('refuses an email already taken', async () => {
    const res = await api.post('/auth/register', { body: { fullName: 'Again', email: 'first@example.test', password: PASSWORD } });
    assert.equal(res.status, 409);
  });

  it('refuses an email with a line break, a long name and a long password', async () => {
    const bad = [
      { fullName: 'A', email: 'a@b.test\r\nBcc: x@evil.test', password: PASSWORD },
      { fullName: 'x'.repeat(161), email: 'long@example.test', password: PASSWORD },
      { fullName: 'A', email: 'pw@example.test', password: 'p'.repeat(73) },
      { fullName: 'A', email: 'short@example.test', password: 'short' },
    ];
    for (const body of bad) assert.equal((await api.post('/auth/register', { body })).status, 400);
  });
});

describe('signing in', () => {
  it('gives the same answer for an unknown email and a wrong password', async () => {
    const student = await makeUser(api);
    const unknown = await api.post('/auth/login', { body: { email: 'nobody@example.test', password: 'wrong-password' } });
    const wrong = await api.post('/auth/login', { body: { email: student.email, password: 'wrong-password' } });
    assert.equal(unknown.status, 401);
    assert.deepEqual(unknown.data, wrong.data);
  });

  it('locks an account out for 15 minutes after 5 wrong passwords', async () => {
    const student = await makeUser(api);
    for (let i = 0; i < 5; i++) {
      assert.equal((await api.post('/auth/login', { body: { email: student.email, password: `wrong-${i}` } })).status, 401);
    }
    assert.equal((await api.signIn(student.email)).status, 429, 'even the right password waits');
  });

  it('shuts out a suspended account on its very next request', async () => {
    const student = await makeUser(api);
    assert.equal((await api.get('/auth/me', { as: student })).status, 200);
    await User.updateStatus(student.id, 'suspended');
    assert.equal((await api.get('/auth/me', { as: student })).status, 403);
  });

  it('ends the session at sign-out', async () => {
    const student = await makeUser(api);
    assert.equal((await api.post('/auth/logout', { as: student })).status, 204);
    assert.equal((await api.get('/auth/me', { as: student })).status, 401);
  });
});

describe('passwords', () => {
  it('signs out other devices when the password changes, but not this one', async () => {
    const student = await makeUser(api);
    const otherDevice = { ...student, cookie: (await api.signIn(student.email)).cookie };
    const res = await api.patch('/auth/password', { as: student, body: { currentPassword: PASSWORD, newPassword: 'a-new-password' } });
    assert.equal(res.status, 204);
    assert.equal((await api.get('/auth/me', { as: student })).status, 200);
    assert.equal((await api.get('/auth/me', { as: otherDevice })).status, 401);
  });

  it('refuses a password change with the wrong current password', async () => {
    const student = await makeUser(api);
    const res = await api.patch('/auth/password', { as: student, body: { currentPassword: 'not-it', newPassword: 'a-new-password' } });
    assert.equal(res.status, 403);
  });

  it('answers a reset request the same whether or not the email has an account', async () => {
    const student = await makeUser(api);
    const known = await api.post('/auth/forgot', { body: { email: student.email } });
    const unknown = await api.post('/auth/forgot', { body: { email: 'nobody-here@example.test' } });
    assert.equal(known.status, 202);
    assert.deepEqual(known.data, unknown.data);
  });

  it('lets a reset link work once, and signs out every device', async () => {
    const student = await makeUser(api);
    const token = randomBytes(32).toString('base64url');
    await PasswordReset.create({ userId: student.id, tokenHash: createHash('sha256').update(token).digest('hex'), minutes: 30 });

    assert.equal((await api.post('/auth/reset', { body: { token, newPassword: 'reset-password-1' } })).status, 204);
    assert.equal((await api.post('/auth/reset', { body: { token, newPassword: 'reset-password-2' } })).status, 400);
    assert.equal((await api.get('/auth/me', { as: student })).status, 401);
    assert.equal((await api.signIn(student.email, 'reset-password-1')).status, 200);
  });

  it('refuses a made-up reset link', async () => {
    assert.equal((await api.post('/auth/reset', { body: { token: 'made-up', newPassword: 'whatever-123' } })).status, 400);
  });
});

describe('protections on every request', () => {
  it('refuses a change sent from another website', async () => {
    const student = await makeUser(api);
    const res = await api.patch('/auth/password', {
      as: student,
      headers: { Origin: 'https://evil.example' },
      body: { currentPassword: PASSWORD, newPassword: 'another-password' },
    });
    assert.equal(res.status, 403);
  });

  it('sends the browser safety headers', async () => {
    const res = await api.get('/health');
    assert.match(res.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
  });

  it('answers malformed JSON with 400, not a server error', async () => {
    const res = await api.post('/auth/login', { headers: { 'Content-Type': 'application/json' }, form: '{not json' });
    assert.equal(res.status, 400);
  });
});
