import './setup.js';
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { makeUser, startApi } from './helpers.js';

const api = await startApi();

let admin;
let instructor;
let student;

before(async () => {
  admin = await makeUser(api, 'admin');
  instructor = await makeUser(api, 'instructor');
  student = await makeUser(api, 'student');
});

describe('who may manage accounts', () => {
  it('lets only an administrator list every account', async () => {
    assert.equal((await api.get('/users', { as: admin })).status, 200);
    assert.equal((await api.get('/users', { as: instructor })).status, 403, 'instructors see only their own students');
    assert.equal((await api.get('/users', { as: student })).status, 403);
  });

  it('lets anyone read and rename their own account, but nobody else\'s', async () => {
    assert.equal((await api.get(`/users/${student.id}`, { as: student })).status, 200);
    assert.equal((await api.patch(`/users/${student.id}`, { as: student, body: { fullName: 'Renamed Student' } })).status, 200);
    assert.equal((await api.get(`/users/${admin.id}`, { as: student })).status, 403);
    assert.equal((await api.patch(`/users/${admin.id}`, { as: student, body: { email: 'mine@evil.test' } })).status, 403);
  });

  it('never lets someone change their own role or status', async () => {
    assert.equal((await api.patch(`/users/${student.id}`, { as: student, body: { role: 'admin' } })).status, 403);
    assert.equal((await api.patch(`/users/${student.id}/status`, { as: student, body: { status: 'active' } })).status, 403);
    assert.equal((await api.patch(`/users/${admin.id}`, { as: admin, body: { role: 'student' } })).status, 409, 'not even an administrator');
    assert.equal((await api.patch(`/users/${admin.id}/status`, { as: admin, body: { status: 'suspended' } })).status, 409);
    assert.equal((await api.delete(`/users/${admin.id}`, { as: admin })).status, 409);
  });

  it('lets an administrator approve, suspend and delete others', async () => {
    const other = await makeUser(api);
    assert.equal((await api.patch(`/users/${other.id}/status`, { as: admin, body: { status: 'suspended' } })).status, 200);
    assert.equal((await api.get('/auth/me', { as: other })).status, 403, 'suspension applies at once');
    assert.equal((await api.delete(`/users/${other.id}`, { as: admin })).status, 204);
    assert.equal((await api.get('/auth/me', { as: other })).status, 401);
  });

  it('answers "not found" for an account id that is not a number', async () => {
    assert.equal((await api.get('/users/abc', { as: admin })).status, 404);
    assert.equal((await api.get('/users/-1', { as: admin })).status, 404);
  });
});

describe('roles and permission exceptions', () => {
  it('lets only role.manage create, change or delete roles', async () => {
    assert.equal((await api.post('/roles', { as: student, body: { name: 'evil', label: 'Evil' } })).status, 403);
    assert.equal((await api.post('/roles', { as: instructor, body: { name: 'evil', label: 'Evil' } })).status, 403);
    const made = await api.post('/roles', { as: admin, body: { name: 'assistant', label: 'Assistant', codes: ['course.read'] } });
    assert.equal(made.status, 201);
    assert.equal((await api.delete(`/roles/${made.data.role.id}`, { as: admin })).status, 204);
  });

  it('refuses to rename or delete a built-in role, or one still held', async () => {
    const { data } = await api.get('/roles', { as: admin });
    const studentRole = data.roles.find((role) => role.name === 'student');
    assert.equal((await api.patch(`/roles/${studentRole.id}`, { as: admin, body: { name: 'learner' } })).status, 409);
    assert.equal((await api.delete(`/roles/${studentRole.id}`, { as: admin })).status, 409);
  });

  it('refuses an unknown permission code instead of dropping it quietly', async () => {
    const res = await api.post('/roles', { as: admin, body: { name: 'typo', label: 'Typo', codes: ['course.reed'] } });
    assert.equal(res.status, 400);
  });

  it('applies a "deny" to one person on their very next request, beating their role', async () => {
    const other = await makeUser(api);
    assert.equal((await api.get('/courses', { as: other })).status, 200);
    const res = await api.put(`/users/${other.id}/permissions`, { as: admin, body: { overrides: [{ code: 'course.read', effect: 'deny' }] } });
    assert.equal(res.status, 200);
    assert.equal((await api.get('/courses', { as: other })).status, 403);
  });

  it('applies an "allow" to one person without changing their role', async () => {
    const other = await makeUser(api);
    assert.equal((await api.get('/users', { as: other })).status, 403);
    await api.put(`/users/${other.id}/permissions`, { as: admin, body: { overrides: [{ code: 'user.read', effect: 'allow' }] } });
    assert.equal((await api.get('/users', { as: other })).status, 200);
  });

  it('stops an administrator denying themselves role.manage', async () => {
    const res = await api.put(`/users/${admin.id}/permissions`, { as: admin, body: { overrides: [{ code: 'role.manage', effect: 'deny' }] } });
    assert.equal(res.status, 409);
  });

  it('takes a permission away from everyone holding a role at once', async () => {
    const { data } = await api.get('/roles', { as: admin });
    const role = data.roles.find((row) => row.name === 'student');
    const { data: before } = await api.get(`/roles/${role.id}`, { as: admin });
    await api.put(`/roles/${role.id}/permissions`, { as: admin, body: { codes: before.codes.filter((code) => code !== 'course.read') } });
    assert.equal((await api.get('/courses', { as: student })).status, 403);
    await api.put(`/roles/${role.id}/permissions`, { as: admin, body: { codes: before.codes } });
    assert.equal((await api.get('/courses', { as: student })).status, 200);
  });
});
