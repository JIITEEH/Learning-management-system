import './setup.js';
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { daysFromNow, fileForm, makeCourse, makeUser, startApi } from './helpers.js';

const api = await startApi();

let admin;
let instructor;
let student;
let outsider;
let course;
let draft;

before(async () => {
  admin = await makeUser(api, 'admin');
  instructor = await makeUser(api, 'instructor');
  student = await makeUser(api, 'student');
  outsider = await makeUser(api, 'student');
  ({ course } = await makeCourse(api, instructor, [student]));
  ({ course: draft } = await makeCourse(api, instructor, [student], { publish: false }));
});

describe('announcements', () => {
  it('lets the instructor post, the course read, and nobody else either', async () => {
    const posted = await api.post(`/courses/${course.id}/announcements`, { as: instructor, body: { title: 'Welcome', body: 'Hello class' } });
    assert.equal(posted.status, 201);
    assert.equal((await api.post(`/courses/${course.id}/announcements`, { as: student, body: { title: 'x' } })).status, 403);
    assert.equal((await api.get(`/courses/${course.id}/announcements`, { as: student })).data.announcements[0].title, 'Welcome');
    assert.equal((await api.get(`/courses/${course.id}/announcements`, { as: outsider })).status, 404);
    assert.equal((await api.patch(`/announcements/${posted.data.announcement.id}`, { as: student, body: { title: 'x' } })).status, 403);
  });

  it('keeps a draft course\'s announcements from its students', async () => {
    await api.post(`/courses/${draft.id}/announcements`, { as: instructor, body: { title: 'Draft news' } });
    assert.equal((await api.get(`/courses/${draft.id}/announcements`, { as: student })).status, 404);
    const titles = (await api.get('/dashboard', { as: student })).data.announcements.map((item) => item.title);
    assert.equal(titles.includes('Draft news'), false);
  });
});

describe('the dashboard', () => {
  it('gives a student progress, what is due (overdue first) and returned grades, but no staff sections', async () => {
    const moduleId = (await api.post(`/courses/${course.id}/modules`, { as: instructor, body: { title: 'W1' } })).data.module.id;
    const lesson = (await api.post(`/modules/${moduleId}/lessons`, { as: instructor, body: { title: 'L1' } })).data.lesson.id;
    await api.post(`/modules/${moduleId}/lessons`, { as: instructor, body: { title: 'L2' } });
    await api.put(`/lessons/${lesson}/progress`, { as: student, body: { completed: true } });
    const make = async (title, dueAt) => (await api.post(`/courses/${course.id}/assignments`, { as: instructor, body: { title, dueAt } })).data.assignment;
    await make('Overdue', daysFromNow(-2));
    await make('Upcoming', daysFromNow(5));
    const graded = await make('Graded', daysFromNow(3));
    const sub = (await api.post(`/assignments/${graded.id}/submission`, { as: student, form: fileForm([], { body: 'x' }) })).data.submission.id;
    await api.patch(`/submissions/${sub}/grade`, { as: instructor, body: { score: 90 } });

    let data = (await api.get('/dashboard', { as: student })).data;
    assert.deepEqual(data.courses.map((c) => [c.lessonsDone, c.lessonCount]), [[1, 2]]);
    assert.deepEqual(data.dueSoon.map((item) => item.title), ['Overdue', 'Upcoming'], 'handed-in work is not "due"');
    assert.deepEqual(data.recentGrades, [], 'not returned yet');
    assert.equal(data.toGrade, undefined);
    assert.equal(data.totals, undefined);

    await api.post(`/submissions/${sub}/return`, { as: instructor });
    data = (await api.get('/dashboard', { as: student })).data;
    assert.deepEqual(data.recentGrades.map((grade) => grade.score), [90]);
  });

  it('gives an instructor work waiting to be graded, and an administrator the totals', async () => {
    const assignment = (await api.post(`/courses/${course.id}/assignments`, { as: instructor, body: { title: 'To mark' } })).data.assignment;
    await api.post(`/assignments/${assignment.id}/submission`, { as: student, form: fileForm([], { body: 'x' }) });
    const teacherView = (await api.get('/dashboard', { as: instructor })).data;
    assert.ok(teacherView.toGrade.some((item) => item.title === 'To mark' && item.waiting === 1));
    const adminView = (await api.get('/dashboard', { as: admin })).data;
    assert.equal(adminView.totals.accounts, 4);
  });

  it('shows an outsider nothing from courses they are not in', async () => {
    const data = (await api.get('/dashboard', { as: outsider })).data;
    assert.deepEqual([data.courses, data.dueSoon, data.announcements], [[], [], []]);
  });
});
