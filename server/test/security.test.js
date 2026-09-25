// Holes found in the step 12 security review, each tested so it stays closed
import './setup.js';
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { fileForm, filesOnDisk, makeCourse, makeUser, startApi } from './helpers.js';

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
