import './setup.js';
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { daysFromNow, fileForm, makeCourse, makeUser, startApi } from './helpers.js';

const api = await startApi();

let admin;
let instructor;
let student;
let classmate;
let course;

before(async () => {
  admin = await makeUser(api, 'admin');
  instructor = await makeUser(api, 'instructor');
  student = await makeUser(api, 'student', 'Ana Santos');
  // A name a spreadsheet would run as a formula
  classmate = await makeUser(api, 'student', '=HYPERLINK("http://evil.example","Click")');
  ({ course } = await makeCourse(api, instructor, [student, classmate]));
});

const newAssignment = async (body) =>
  (await api.post(`/courses/${course.id}/assignments`, { as: instructor, body: { title: 'Task', ...body } })).data.assignment;
const handIn = (who, assignment, body = 'my answer', files = []) =>
  api.post(`/assignments/${assignment.id}/submission`, { as: who, form: fileForm(files, { body }) });

describe('assignments', () => {
  it('requires a due date to say its time zone, and stores it in UTC', async () => {
    const bad = await api.post(`/courses/${course.id}/assignments`, { as: instructor, body: { title: 'x', dueAt: '2030-01-01 09:00' } });
    assert.equal(bad.status, 400);
    const good = await newAssignment({ dueAt: '2030-01-01T09:00:00+08:00' });
    assert.equal(good.dueAt, '2030-01-01 01:00:00');
  });

  it('lets only staff create them', async () => {
    assert.equal((await api.post(`/courses/${course.id}/assignments`, { as: student, body: { title: 'x' } })).status, 403);
  });
});

describe('handing in', () => {
  it('needs an answer or a file', async () => {
    const assignment = await newAssignment({});
    assert.equal((await handIn(student, assignment, '')).status, 400);
  });

  it('accepts late work and marks it late', async () => {
    const assignment = await newAssignment({ dueAt: daysFromNow(-1) });
    const res = await handIn(student, assignment);
    assert.equal(res.status, 201);
    assert.equal(res.data.submission.late, true);
  });

  it('lets work change until it is graded, then locks it', async () => {
    const assignment = await newAssignment({});
    const first = await handIn(student, assignment, 'draft');
    assert.equal((await handIn(student, assignment, 'final')).data.submission.body, 'final');
    await api.patch(`/submissions/${first.data.submission.id}/grade`, { as: instructor, body: { score: 50 } });
    assert.equal((await handIn(student, assignment, 'sneaky edit')).status, 409);
  });

  it('refuses hand-ins from staff and outsiders, and to a closed course', async () => {
    const assignment = await newAssignment({});
    assert.equal((await handIn(instructor, assignment)).status, 403);
    assert.equal((await handIn(admin, assignment)).status, 403);
    const { course: closed } = await makeCourse(api, instructor, [student]);
    const late = (await api.post(`/courses/${closed.id}/assignments`, { as: instructor, body: { title: 'x' } })).data.assignment;
    await api.patch(`/courses/${closed.id}/status`, { as: instructor, body: { status: 'archived' } });
    assert.equal((await handIn(student, late)).status, 409);
  });
});

describe('privacy of submissions', () => {
  it('never shows a student\'s work or files to a classmate', async () => {
    const assignment = await newAssignment({});
    const { data } = await handIn(student, assignment, 'private answer', [{ name: 'essay.txt' }]);
    const { id, files } = data.submission;
    assert.equal((await api.get(`/submissions/${id}`, { as: classmate })).status, 404);
    assert.equal((await api.get(`/files/${files[0].id}/download`, { as: classmate })).status, 404);
    assert.equal((await api.delete(`/submissions/${id}/files/${files[0].id}`, { as: classmate })).status, 404);
    assert.equal((await api.get(`/assignments/${assignment.id}/submissions`, { as: classmate })).status, 403);
    const classmateFiles = (await api.get('/files', { as: classmate })).data.files;
    assert.equal(classmateFiles.some((file) => file.id === files[0].id), false);
    // The student and the instructor can
    assert.equal((await api.get(`/files/${files[0].id}/download`, { as: student })).status, 200);
    assert.equal((await api.get(`/files/${files[0].id}/download`, { as: instructor })).status, 200);
  });
});

describe('grading', () => {
  it('keeps a grade out of every reply to the student until it is returned', async () => {
    const assignment = await newAssignment({ maxScore: 50 });
    const submissionId = (await handIn(student, assignment)).data.submission.id;
    await api.patch(`/submissions/${submissionId}/grade`, { as: instructor, body: { score: 42, feedback: 'Well argued' } });

    for (const path of [`/assignments/${assignment.id}`, `/submissions/${submissionId}`, `/courses/${course.id}/assignments`]) {
      const raw = JSON.stringify((await api.get(path, { as: student })).data);
      assert.equal(raw.includes('Well argued') || raw.includes('"score":42'), false, `${path} leaks the grade`);
    }

    assert.equal((await api.post(`/assignments/${assignment.id}/return-all`, { as: instructor })).data.returned, 1);
    const { data } = await api.get(`/assignments/${assignment.id}`, { as: student });
    assert.equal(data.mySubmission.score, 42);
    assert.equal(data.mySubmission.feedback, 'Well argued');
  });

  it('lets a returned grade be corrected, and the student sees the correction', async () => {
    const assignment = await newAssignment({});
    const submissionId = (await handIn(student, assignment)).data.submission.id;
    await api.patch(`/submissions/${submissionId}/grade`, { as: instructor, body: { score: 60 } });
    await api.post(`/submissions/${submissionId}/return`, { as: instructor });
    await api.patch(`/submissions/${submissionId}/grade`, { as: instructor, body: { score: 70 } });
    assert.equal((await api.get(`/assignments/${assignment.id}`, { as: student })).data.mySubmission.score, 70);
  });

  it('refuses scores outside 0 to the maximum, and grading by students', async () => {
    const assignment = await newAssignment({ maxScore: 10 });
    const submissionId = (await handIn(student, assignment)).data.submission.id;
    assert.equal((await api.patch(`/submissions/${submissionId}/grade`, { as: instructor, body: { score: 11 } })).status, 400);
    assert.equal((await api.patch(`/submissions/${submissionId}/grade`, { as: instructor, body: { score: -1 } })).status, 400);
    assert.equal((await api.patch(`/submissions/${submissionId}/grade`, { as: student, body: { score: 10 } })).status, 403);
    assert.equal((await api.post(`/submissions/${submissionId}/return`, { as: instructor })).status, 409, 'nothing to return yet');
  });
});

describe('the gradebook', () => {
  it('is for staff only, and its CSV turns formulas into plain text', async () => {
    assert.equal((await api.get(`/courses/${course.id}/gradebook`, { as: student })).status, 403);
    const csv = await api.get(`/courses/${course.id}/gradebook.csv`, { as: instructor });
    assert.equal(csv.status, 200);
    assert.match(csv.headers.get('content-disposition'), /^attachment; filename="TEST\d+-gradebook-\d{4}-\d{2}-\d{2}\.csv"$/);
    assert.ok(csv.data.includes(`"'=HYPERLINK(`), 'the formula starts with a quote');
    assert.equal(/(^|,)=HYPERLINK/m.test(csv.data), false);
  });
});
