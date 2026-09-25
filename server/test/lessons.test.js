import './setup.js';
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { fileForm, filesOnDisk, makeCourse, makeUser, startApi } from './helpers.js';

const api = await startApi();

let instructor;
let student;
let outsider;
let course;
let moduleId;
let lessonId;

before(async () => {
  instructor = await makeUser(api, 'instructor');
  student = await makeUser(api, 'student');
  outsider = await makeUser(api, 'student');
  ({ course } = await makeCourse(api, instructor, [student]));
  moduleId = (await api.post(`/courses/${course.id}/modules`, { as: instructor, body: { title: 'Week 1' } })).data.module.id;
  lessonId = (await api.post(`/modules/${moduleId}/lessons`, { as: instructor, body: { title: 'First', content: 'Hello' } })).data.lesson.id;
});

describe('who may do what with lessons', () => {
  it('lets enrolled students read, and outsiders see "not found"', async () => {
    assert.equal((await api.get(`/lessons/${lessonId}`, { as: student })).status, 200);
    assert.equal((await api.get(`/lessons/${lessonId}`, { as: outsider })).status, 404);
    assert.equal((await api.get(`/courses/${course.id}/modules`, { as: outsider })).status, 404);
  });

  it('lets only the instructor add, edit, move and delete', async () => {
    assert.equal((await api.post(`/courses/${course.id}/modules`, { as: student, body: { title: 'x' } })).status, 403);
    assert.equal((await api.patch(`/lessons/${lessonId}`, { as: student, body: { title: 'x' } })).status, 403);
    assert.equal((await api.post(`/lessons/${lessonId}/move`, { as: student, body: { direction: 'up' } })).status, 403);
    assert.equal((await api.delete(`/lessons/${lessonId}`, { as: student })).status, 403);
  });

  it('refuses lesson text over the limit', async () => {
    const res = await api.patch(`/lessons/${lessonId}`, { as: instructor, body: { content: 'x'.repeat(50001) } });
    assert.equal(res.status, 400);
  });
});

describe('order and progress', () => {
  it('moves lessons and modules one place at a time', async () => {
    const second = (await api.post(`/modules/${moduleId}/lessons`, { as: instructor, body: { title: 'Second' } })).data.lesson.id;
    await api.post(`/lessons/${second}/move`, { as: instructor, body: { direction: 'up' } });
    const { data } = await api.get(`/courses/${course.id}/modules`, { as: instructor });
    assert.deepEqual(data.modules[0].lessons.map((lesson) => lesson.title), ['Second', 'First']);
    assert.equal((await api.post(`/lessons/${second}/move`, { as: instructor, body: { direction: 'sideways' } })).status, 400);
  });

  it('records progress for enrolled students only, and shows it in the outline', async () => {
    assert.equal((await api.put(`/lessons/${lessonId}/progress`, { as: instructor, body: { completed: true } })).status, 403);
    assert.equal((await api.put(`/lessons/${lessonId}/progress`, { as: student, body: { completed: true } })).status, 200);
    const { data } = await api.get(`/courses/${course.id}/modules`, { as: student });
    assert.equal(data.progress.completed, 1);
    assert.equal(data.modules[0].lessons.find((lesson) => lesson.id === lessonId).completed, true);
  });
});

describe('lesson files', () => {
  it('accepts allowed types, and downloads only as an attachment', async () => {
    const res = await api.post(`/lessons/${lessonId}/files`, { as: instructor, form: fileForm([{ name: 'notes.pdf', type: 'application/pdf' }]) });
    assert.equal(res.status, 201);
    const download = await api.get(`/files/${res.data.files[0].id}/download`, { as: student });
    assert.equal(download.status, 200);
    assert.match(download.headers.get('content-disposition'), /^attachment/);
    assert.equal(download.headers.get('x-content-type-options'), 'nosniff');
    assert.equal((await api.get(`/files/${res.data.files[0].id}/download`, { as: outsider })).status, 404);
  });

  it('refuses a web page, and leaves nothing on disk from the refused request', async () => {
    const before = filesOnDisk();
    const res = await api.post(`/lessons/${lessonId}/files`, {
      as: instructor,
      form: fileForm([{ name: 'fine.txt' }, { name: 'page.html', type: 'text/html', contents: '<script>alert(1)</script>' }]),
    });
    assert.equal(res.status, 415);
    assert.equal(filesOnDisk(), before);
  });

  it('refuses a file over 25 MB, and leaves nothing on disk', async () => {
    const before = filesOnDisk();
    const res = await api.post(`/lessons/${lessonId}/files`, {
      as: instructor,
      form: fileForm([{ name: 'big.pdf', type: 'application/pdf', contents: new Uint8Array(26 * 1024 * 1024) }]),
    });
    assert.equal(res.status, 413);
    assert.equal(filesOnDisk(), before);
  });

  it('never lets a student upload to a lesson, and saves nothing when refused', async () => {
    const before = filesOnDisk();
    const res = await api.post(`/lessons/${lessonId}/files`, { as: student, form: fileForm([{ name: 'x.txt' }]) });
    assert.equal(res.status, 403);
    assert.equal(filesOnDisk(), before);
  });

  it('deletes a lesson\'s files from disk when the lesson goes', async () => {
    const lesson = (await api.post(`/modules/${moduleId}/lessons`, { as: instructor, body: { title: 'Temporary' } })).data.lesson.id;
    await api.post(`/lessons/${lesson}/files`, { as: instructor, form: fileForm([{ name: 'a.txt' }, { name: 'b.txt' }]) });
    const before = filesOnDisk();
    assert.equal((await api.delete(`/lessons/${lesson}`, { as: instructor })).status, 204);
    assert.equal(filesOnDisk(), before - 2);
  });
});
