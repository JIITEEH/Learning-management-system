import './setup.js';
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { daysFromNow, fileForm, makeCourse, makeUser, startApi } from './helpers.js';

const api = await startApi();

let instructor;
let student;
let outsider;
let course;

before(async () => {
  instructor = await makeUser(api, 'instructor');
  student = await makeUser(api, 'student');
  outsider = await makeUser(api, 'student');
  ({ course } = await makeCourse(api, instructor, [student]));
});

const lecture = { title: 'Lecture', dayOfWeek: 1, startsAt: '09:00', endsAt: '10:30', location: 'Room 204', effectiveFrom: '2026-06-01' };
const addMeeting = (body, as = instructor, courseId = course.id) => api.post(`/courses/${courseId}/schedules`, { as, body });

describe('who may see and change a timetable', () => {
  it('lets the instructor add meetings, the course read them, and nobody else either', async () => {
    const res = await addMeeting(lecture);
    assert.equal(res.status, 201);
    assert.deepEqual(res.data.warnings, []);
    assert.equal(res.data.schedule.startsAt, '09:00');
    assert.equal((await addMeeting(lecture, student)).status, 403);
    assert.equal((await api.get(`/courses/${course.id}/schedules`, { as: student })).data.schedules.length, 1);
    assert.equal((await api.get(`/courses/${course.id}/schedules`, { as: outsider })).status, 404);
    const id = res.data.schedule.id;
    assert.equal((await api.patch(`/schedules/${id}`, { as: student, body: { location: 'x' } })).status, 403);
    assert.equal((await api.delete(`/schedules/${id}`, { as: outsider })).status, 403);
  });

  it('lets the instructor edit one field and keep the rest, and delete', async () => {
    const id = (await addMeeting({ ...lecture, dayOfWeek: 5 })).data.schedule.id;
    const edited = await api.patch(`/schedules/${id}`, { as: instructor, body: { location: 'Lab 3' } });
    assert.equal(edited.status, 200);
    assert.equal(edited.data.schedule.location, 'Lab 3');
    assert.equal(edited.data.schedule.startsAt, '09:00');
    assert.equal((await api.delete(`/schedules/${id}`, { as: instructor })).status, 204);
  });
});

describe('checking what is entered', () => {
  it('refuses a class that ends before it starts, a bad day, time or date, and an end before the start date', async () => {
    const bad = [
      { ...lecture, endsAt: '08:00' },
      { ...lecture, dayOfWeek: 7 },
      { ...lecture, startsAt: '9am' },
      { ...lecture, effectiveFrom: '2026-02-30' },
      { ...lecture, effectiveTo: '2026-05-01' },
      { ...lecture, effectiveFrom: undefined },
    ];
    for (const body of bad) assert.equal((await addMeeting(body)).status, 400, JSON.stringify(body));
  });
});

describe('overlapping classes', () => {
  it('warns about an overlap in the same course but still saves it', async () => {
    const { course: other } = await makeCourse(api, instructor, [student]);
    await addMeeting({ ...lecture, dayOfWeek: 3 }, instructor, other.id);
    const res = await addMeeting({ ...lecture, title: 'Lab', dayOfWeek: 3, startsAt: '10:00', endsAt: '12:00' }, instructor, other.id);
    assert.equal(res.status, 201);
    assert.deepEqual(res.data.warnings, ['Overlaps Lecture (Wednesday 09:00–10:30)']);
  });

  it('does not warn when the times only touch, or the date ranges do not meet', async () => {
    const { course: other } = await makeCourse(api, instructor);
    await addMeeting({ ...lecture, dayOfWeek: 2, effectiveTo: '2026-07-31' }, instructor, other.id);
    const touching = await addMeeting({ ...lecture, dayOfWeek: 2, startsAt: '10:30', endsAt: '11:30' }, instructor, other.id);
    const later = await addMeeting({ ...lecture, dayOfWeek: 2, effectiveFrom: '2026-08-01' }, instructor, other.id);
    assert.deepEqual([touching.data.warnings, later.data.warnings], [[], []]);
  });
});

describe('my week', () => {
  it('gathers meetings from every course someone teaches or takes, and none from others', async () => {
    const { course: notMine } = await makeCourse(api, instructor);
    await addMeeting({ ...lecture, title: 'Not for the student' }, instructor, notMine.id);
    const mine = (await api.get('/schedules/me', { as: student })).data.schedules;
    assert.ok(mine.length > 0);
    assert.equal(mine.some((meeting) => meeting.title === 'Not for the student'), false);
    assert.ok(mine.every((meeting) => meeting.courseCode));
    assert.deepEqual((await api.get('/schedules/me', { as: outsider })).data.schedules, []);
    const taught = (await api.get('/schedules/me', { as: instructor })).data.schedules;
    assert.ok(taught.some((meeting) => meeting.title === 'Not for the student'));
  });
});

describe('deadline calendar', () => {
  const range = (from, to) => `/schedules/deadlines?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const assign = async (courseId, title, dueAt) =>
    (await api.post(`/courses/${courseId}/assignments`, { as: instructor, body: { title, dueAt } })).data.assignment;
  const handIn = (assignment, who = student) =>
    api.post(`/assignments/${assignment.id}/submission`, { as: who, form: fileForm([], { body: 'My work' }) });

  it('shows a student the due dates in the range, each marked handed in, late, missing or not yet', async () => {
    const { course: mine } = await makeCourse(api, instructor, [student]);
    const handedIn = await assign(mine.id, 'Handed in', daysFromNow(2));
    await assign(mine.id, 'Not yet', daysFromNow(3));
    await assign(mine.id, 'Missing', daysFromNow(-2));
    const late = await assign(mine.id, 'Late', daysFromNow(-1));
    await assign(mine.id, 'Too far ahead', daysFromNow(40));
    await assign(mine.id, 'No due date', null);
    assert.equal((await handIn(handedIn)).status, 201);
    assert.equal((await handIn(late)).status, 201);

    const res = await api.get(range(daysFromNow(-5), daysFromNow(10)), { as: student });
    assert.equal(res.status, 200);
    const mark = Object.fromEntries(res.data.deadlines.filter((d) => d.courseId === mine.id).map((d) => [d.title, d.status]));
    assert.deepEqual(mark, { Missing: 'missing', Late: 'late', 'Handed in': 'handedIn', 'Not yet': 'notYet' });
  });

  it('shows the instructor their own deadlines unmarked, and nobody else anything', async () => {
    const { course: mine } = await makeCourse(api, instructor, [student]);
    await assign(mine.id, 'Instructor sees this', daysFromNow(1));
    const window = range(daysFromNow(0), daysFromNow(5));
    const taught = (await api.get(window, { as: instructor })).data.deadlines;
    assert.ok(taught.some((d) => d.title === 'Instructor sees this' && d.status === null));
    assert.equal((await api.get(window, { as: outsider })).data.deadlines.length, 0);
  });

  it('hides a draft course from its students', async () => {
    const { course: draft } = await makeCourse(api, instructor, [student], { publish: false });
    await assign(draft.id, 'Still a draft', daysFromNow(1));
    const seen = (await api.get(range(daysFromNow(0), daysFromNow(5)), { as: student })).data.deadlines;
    assert.equal(seen.some((d) => d.title === 'Still a draft'), false);
  });

  it('shows quizzes by their closing time, marked once taken, and hides unpublished ones from students', async () => {
    const { course: mine } = await makeCourse(api, instructor, [student]);
    const makeQuiz = async (title, publish) => {
      const quiz = (await api.post(`/courses/${mine.id}/quizzes`, { as: instructor, body: { title, dueAt: daysFromNow(2) } })).data.quiz;
      const question = { kind: 'true_false', prompt: 'Water is wet.', answer: true };
      await api.post(`/quizzes/${quiz.id}/questions`, { as: instructor, body: question });
      if (publish) await api.patch(`/quizzes/${quiz.id}`, { as: instructor, body: { isPublished: true } });
      return quiz;
    };
    const taken = await makeQuiz('Taken quiz', true);
    await makeQuiz('Open quiz', true);
    await makeQuiz('Hidden quiz', false);
    const attempt = (await api.post(`/quizzes/${taken.id}/attempts`, { as: student })).data.attempt;
    await api.post(`/attempts/${attempt.id}/submit`, { as: student, body: { answers: [] } });

    const window = range(daysFromNow(0), daysFromNow(5));
    const seen = (await api.get(window, { as: student })).data.deadlines.filter((d) => d.courseId === mine.id);
    assert.deepEqual(seen.map((d) => [d.kind, d.title, d.status]), [['quiz', 'Taken quiz', 'handedIn'], ['quiz', 'Open quiz', 'notYet']]);
    const taught = (await api.get(window, { as: instructor })).data.deadlines.filter((d) => d.courseId === mine.id);
    assert.equal(taught.length, 3, 'the instructor also sees the quiz still being built');
  });

  it('refuses a missing, zoneless, backwards or over-long range', async () => {
    const bad = [
      '/schedules/deadlines',
      range('2026-10-01T00:00', '2026-11-01T00:00'),
      range('2026-11-01T00:00:00Z', '2026-10-01T00:00:00Z'),
      range('2026-01-01T00:00:00Z', '2026-06-01T00:00:00Z'),
    ];
    for (const path of bad) assert.equal((await api.get(path, { as: student })).status, 400, path);
  });
});
