// Holes found in the step 12 security review, each tested so it stays closed
import './setup.js';
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { PASSWORD, fileForm, filesOnDisk, makeCourse, makeUser, startApi } from './helpers.js';
import { query } from '../src/database/index.js';

const api = await startApi();

let instructor;
let student;
let course;

before(async () => {
  instructor = await makeUser(api, 'instructor');
  student = await makeUser(api, 'student');
  ({ course } = await makeCourse(api, instructor, [student]));
});

const tenFiles = (prefix) => Array.from({ length: 10 }, (_, index) => ({ name: `${prefix}-${index}.txt` }));

describe('nobody can fill the disk by uploading again and again', () => {
  it('caps a submission at 10 files in total, and saves nothing from a refused upload', async () => {
    const assignment = (await api.post(`/courses/${course.id}/assignments`, { as: instructor, body: { title: 'Essay' } })).data.assignment;
    const first = await api.post(`/assignments/${assignment.id}/submission`, { as: student, form: fileForm(tenFiles('a'), { body: 'x' }) });
    assert.equal(first.status, 201);
    const before = filesOnDisk();
    const more = await api.post(`/assignments/${assignment.id}/submission`, { as: student, form: fileForm([{ name: 'one-more.txt' }], { body: 'x' }) });
    assert.equal(more.status, 409);
    assert.equal(filesOnDisk(), before);
    // Handing in again with no new files still works
    assert.equal((await api.post(`/assignments/${assignment.id}/submission`, { as: student, form: fileForm([], { body: 'y' }) })).status, 200);
  });

  it('caps a lesson at 30 files in total', async () => {
    const moduleId = (await api.post(`/courses/${course.id}/modules`, { as: instructor, body: { title: 'W' } })).data.module.id;
    const lessonId = (await api.post(`/modules/${moduleId}/lessons`, { as: instructor, body: { title: 'L' } })).data.lesson.id;
    for (const prefix of ['a', 'b', 'c']) {
      assert.equal((await api.post(`/lessons/${lessonId}/files`, { as: instructor, form: fileForm(tenFiles(prefix)) })).status, 201);
    }
    const before = filesOnDisk();
    assert.equal((await api.post(`/lessons/${lessonId}/files`, { as: instructor, form: fileForm([{ name: 'x.txt' }]) })).status, 409);
    assert.equal(filesOnDisk(), before);
  });
});

describe('long text within the stated limits', () => {
  // Chinese characters take 3 bytes each, so this is about 150 KB: the most the form allows
  it('accepts a lesson of 50,000 three-byte characters', async () => {
    const moduleId = (await api.post(`/courses/${course.id}/modules`, { as: instructor, body: { title: 'W' } })).data.module.id;
    const lessonId = (await api.post(`/modules/${moduleId}/lessons`, { as: instructor, body: { title: 'Long' } })).data.lesson.id;
    const res = await api.patch(`/lessons/${lessonId}`, { as: instructor, body: { content: '字'.repeat(50000) } });
    assert.equal(res.status, 204);
  });
});

describe('guessing a password from inside a signed-in session', () => {
  it('limits wrong current-password attempts when changing the password', async () => {
    const victim = await makeUser(api);
    const statuses = [];
    for (let i = 0; i < 11; i++) {
      const res = await api.patch('/auth/password', { as: victim, body: { currentPassword: `guess-${i}`, newPassword: 'new-password-1' } });
      statuses.push(res.status);
    }
    assert.equal(statuses.at(-1), 429, `answers were ${statuses.join(', ')}`);
    assert.equal((await api.signIn(victim.email, PASSWORD)).status, 200, 'the real password still works at sign-in');
  });
});

describe('deleting an account', () => {
  it('deletes the files of the work that goes with it', async () => {
    const admin = await makeUser(api, 'admin');
    const leaving = await makeUser(api);
    await api.post('/enrollments', { as: instructor, body: { courseId: course.id, email: leaving.email } });
    const assignment = (await api.post(`/courses/${course.id}/assignments`, { as: instructor, body: { title: 'Leaver task' } })).data.assignment;
    await api.post(`/assignments/${assignment.id}/submission`, { as: leaving, form: fileForm([{ name: 'a.txt' }, { name: 'b.txt' }], { body: 'x' }) });
    const before = filesOnDisk();
    assert.equal((await api.delete(`/users/${leaving.id}`, { as: admin })).status, 204);
    assert.equal(filesOnDisk(), before - 2);
    const [{ orphans }] = await query(
      "SELECT COUNT(*) AS orphans FROM files f LEFT JOIN submissions s ON s.id = f.owner_id WHERE f.owner_type = 'submission' AND s.id IS NULL",
    );
    assert.equal(orphans, 0);
  });
});
