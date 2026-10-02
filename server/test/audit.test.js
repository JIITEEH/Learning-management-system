import './setup.js';
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { makeCourse, makeUser, startApi } from './helpers.js';

const api = await startApi();

let admin;
let instructor;
let student;

before(async () => {
  admin = await makeUser(api, 'admin', 'Ada Admin');
  instructor = await makeUser(api, 'instructor', 'Ian Instructor');
  student = await makeUser(api, 'student', 'Sam Student');
});

const log = async (query = '') => (await api.get(`/audit${query}`, { as: admin })).data;
const latest = async (query = '') => (await log(query)).entries[0];

describe('who may read the log', () => {
  it('lets an administrator read it, and refuses instructors, students and visitors', async () => {
    assert.equal((await api.get('/audit', { as: admin })).status, 200);
    assert.equal((await api.get('/audit', { as: instructor })).status, 403);
    assert.equal((await api.get('/audit', { as: student })).status, 403);
    assert.equal((await api.get('/audit')).status, 401);
  });
});

describe('what gets recorded', () => {
  it('records an account being suspended, by whom, and from what to what', async () => {
    await api.patch(`/users/${student.id}/status`, { as: admin, body: { status: 'suspended' } });
    const entry = await latest();
    assert.equal(entry.action, 'user.suspended');
    assert.equal(entry.actorName, 'Ada Admin');
    assert.equal(entry.targetLabel, `Sam Student (${student.email})`);
    assert.equal(entry.details, 'active → suspended');
    await api.patch(`/users/${student.id}/status`, { as: admin, body: { status: 'active' } });
    assert.equal((await latest()).action, 'user.reactivated');
  });

  it('records a role change, but not someone editing their own name', async () => {
    const other = await makeUser(api, 'student');
    await api.patch(`/users/${other.id}`, { as: admin, body: { role: 'instructor' } });
    assert.equal((await latest()).details, 'Student → Instructor');
    const count = (await log()).entries.length;
    await api.patch(`/users/${instructor.id}`, { as: instructor, body: { fullName: 'Ian I. Instructor' } });
    assert.equal((await log()).entries.length, count);
  });

  it('records which permission codes a role gained and lost', async () => {
    const role = (await api.post('/roles', { as: admin, body: { name: 'helper', label: 'Helper', codes: ['course.read'] } })).data.role;
    assert.equal((await latest()).action, 'role.created');
    await api.put(`/roles/${role.id}/permissions`, { as: admin, body: { codes: ['lesson.read'] } });
    const entry = await latest();
    assert.equal(entry.action, 'role.permissions_changed');
    assert.equal(entry.details, 'Added: lesson.read. Removed: course.read');
  });

  it('records an instructor taking a student out of a course, against the course', async () => {
    const { course } = await makeCourse(api, instructor, [student]);
    const roster = (await api.get(`/courses/${course.id}/roster`, { as: instructor })).data;
    const enrollment = roster.enrollments.find((row) => row.userId === student.id);
    await api.delete(`/enrollments/${enrollment.id}`, { as: instructor });
    const entry = await latest('?target=course');
    assert.equal(entry.action, 'enrollment.removed');
    assert.equal(entry.targetId, course.id);
    assert.match(entry.targetLabel, /Sam Student/);
    assert.ok((await log('?target=course')).entries.every((row) => row.targetType === 'course'));
  });

  it('keeps the name of whoever made a change after their account is deleted', async () => {
    const departing = await makeUser(api, 'admin', 'Dee Departing');
    const target = await makeUser(api, 'student');
    await api.patch(`/users/${target.id}/status`, { as: departing, body: { status: 'suspended' } });
    await api.delete(`/users/${departing.id}`, { as: admin });
    const entries = (await log('?target=user')).entries;
    assert.equal(entries[0].action, 'user.deleted');
    const byDeparted = entries.find((row) => row.actorName === 'Dee Departing');
    assert.equal(byDeparted.actorId, null);
    assert.equal(byDeparted.action, 'user.suspended');
  });
});

describe('paging through the log', () => {
  it('returns newest first, a page at a time', async () => {
    const first = await log('?limit=2');
    assert.equal(first.entries.length, 2);
    assert.ok(first.entries[0].id > first.entries[1].id);
    const next = await log(`?limit=2&before=${first.nextBefore}`);
    assert.ok(next.entries[0].id < first.entries[1].id);
  });
});
