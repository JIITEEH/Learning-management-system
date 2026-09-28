import './setup.js';
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { makeCourse, makeUser, startApi } from './helpers.js';

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
