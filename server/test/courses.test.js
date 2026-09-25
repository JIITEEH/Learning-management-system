import './setup.js';
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { fileForm, filesOnDisk, makeCourse, makeUser, startApi } from './helpers.js';
import { query } from '../src/database/index.js';

const api = await startApi();

let admin;
let instructor;
let otherInstructor;
let student;
let outsider;

before(async () => {
  admin = await makeUser(api, 'admin');
  instructor = await makeUser(api, 'instructor');
  otherInstructor = await makeUser(api, 'instructor');
  student = await makeUser(api, 'student');
  outsider = await makeUser(api, 'student');
});

describe('seeing a course', () => {
  it('hides a draft from its students, and every course from outsiders, as "not found"', async () => {
    const { course } = await makeCourse(api, instructor, [student], { publish: false });
    assert.equal((await api.get(`/courses/${course.id}`, { as: instructor })).status, 200);
    assert.equal((await api.get(`/courses/${course.id}`, { as: student })).status, 404);
    assert.equal((await api.get(`/courses/${course.id}`, { as: outsider })).status, 404);
    assert.equal((await api.get(`/courses/${course.id}`, { as: otherInstructor })).status, 404);
    assert.equal((await api.get(`/courses/${course.id}`, { as: admin })).status, 200);
  });

  it('shows the join code only to those who manage the course', async () => {
    const { course } = await makeCourse(api, instructor, [student]);
    assert.ok((await api.get(`/courses/${course.id}`, { as: instructor })).data.course.joinCode);
    assert.equal((await api.get(`/courses/${course.id}`, { as: student })).data.course.joinCode, undefined);
  });

  it('lets only the course\'s instructor or an administrator change it', async () => {
    const { course } = await makeCourse(api, instructor, [student]);
    assert.equal((await api.patch(`/courses/${course.id}`, { as: student, body: { title: 'x' } })).status, 403);
    assert.equal((await api.patch(`/courses/${course.id}`, { as: otherInstructor, body: { title: 'x' } })).status, 404);
    assert.equal((await api.patch(`/courses/${course.id}`, { as: admin, body: { title: 'Renamed' } })).status, 200);
    assert.equal((await api.get(`/courses/${course.id}/roster`, { as: student })).status, 403);
  });
});

describe('joining', () => {
  it('lets a student join an open course with its code, ignoring case and dashes', async () => {
    const { course, joinCode } = await makeCourse(api, instructor);
    const typed = `${joinCode.slice(0, 4)}-${joinCode.slice(4)}`.toLowerCase();
    assert.equal((await api.post('/enrollments/me', { as: outsider, body: { joinCode: typed } })).status, 201);
    assert.equal((await api.get(`/courses/${course.id}`, { as: outsider })).status, 200);
  });

  it('gives the same answer for a wrong code and a draft course\'s code', async () => {
    const { joinCode } = await makeCourse(api, instructor, [], { publish: false });
    const draft = await api.post('/enrollments/me', { as: student, body: { joinCode } });
    const wrong = await api.post('/enrollments/me', { as: student, body: { joinCode: 'ZZZZZZZZ' } });
    assert.equal(draft.status, 404);
    assert.deepEqual(draft.data, wrong.data);
  });

  it('keeps a dropped student out until the instructor adds them back', async () => {
    const { course, joinCode } = await makeCourse(api, instructor, [student]);
    const { data } = await api.get(`/courses/${course.id}/roster`, { as: instructor });
    const enrollment = data.enrollments.find((row) => row.userId === student.id);
    await api.patch(`/enrollments/${enrollment.id}`, { as: instructor, body: { status: 'dropped' } });
    assert.equal((await api.post('/enrollments/me', { as: student, body: { joinCode } })).status, 403);
    assert.equal((await api.get(`/courses/${course.id}`, { as: student })).status, 404);
    assert.equal((await api.post('/enrollments', { as: instructor, body: { courseId: course.id, email: student.email } })).status, 201);
    assert.equal((await api.get(`/courses/${course.id}`, { as: student })).status, 200);
  });
});

describe('deleting a course', () => {
  it('requires archiving first, and course.delete (which instructors do not hold)', async () => {
    const { course } = await makeCourse(api, instructor);
    assert.equal((await api.delete(`/courses/${course.id}`, { as: instructor })).status, 403);
    assert.equal((await api.delete(`/courses/${course.id}`, { as: admin })).status, 409);
  });

  // MySQL 26.7.0 left the lessons of every module but the first behind when a course was deleted
  // (see database/README.md), so this builds several modules on purpose
  it('removes every module, lesson, progress record, assignment, submission and file', async () => {
    const { course } = await makeCourse(api, instructor, [student]);
    for (const title of ['Week 1', 'Week 2', 'Week 3']) {
      const courseModule = (await api.post(`/courses/${course.id}/modules`, { as: instructor, body: { title } })).data.module;
      const lesson = (await api.post(`/modules/${courseModule.id}/lessons`, { as: instructor, body: { title: 'L' } })).data.lesson;
      await api.post(`/lessons/${lesson.id}/files`, { as: instructor, form: fileForm([{ name: 'notes.txt' }]) });
      await api.put(`/lessons/${lesson.id}/progress`, { as: student, body: { completed: true } });
    }
    const assignment = (await api.post(`/courses/${course.id}/assignments`, { as: instructor, body: { title: 'Essay' } })).data.assignment;
    await api.post(`/assignments/${assignment.id}/submission`, { as: student, form: fileForm([{ name: 'essay.txt' }], { body: 'answer' }) });
    assert.equal(filesOnDisk(), 4);

    await api.patch(`/courses/${course.id}/status`, { as: admin, body: { status: 'archived' } });
    assert.equal((await api.delete(`/courses/${course.id}`, { as: admin })).status, 204);

    const [left] = await query(
      `SELECT (SELECT COUNT(*) FROM modules) AS modules, (SELECT COUNT(*) FROM lessons l LEFT JOIN modules m ON m.id = l.module_id WHERE m.id IS NULL) AS orphan_lessons,
              (SELECT COUNT(*) FROM lesson_progress p LEFT JOIN lessons l ON l.id = p.lesson_id WHERE l.id IS NULL) AS orphan_progress,
              (SELECT COUNT(*) FROM submissions s LEFT JOIN assignments a ON a.id = s.assignment_id WHERE a.id IS NULL) AS orphan_submissions,
              (SELECT COUNT(*) FROM files) AS files`,
    );
    assert.deepEqual(left, { modules: 0, orphan_lessons: 0, orphan_progress: 0, orphan_submissions: 0, files: 0 });
    assert.equal(filesOnDisk(), 0);
  });
});
