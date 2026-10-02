import './setup.js';
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { fileForm, makeCourse, makeUser, startApi } from './helpers.js';

const api = await startApi();

let instructor;
let student;
let classmate;
let outsider;

before(async () => {
  instructor = await makeUser(api, 'instructor');
  student = await makeUser(api, 'student');
  classmate = await makeUser(api, 'student');
  outsider = await makeUser(api, 'student');
});

const inbox = async (who) => (await api.get('/notifications', { as: who })).data;
const titles = async (who) => (await inbox(who)).notifications.map((n) => `${n.title}: ${n.body}`);

describe('who is told what', () => {
  it('tells a course\'s students about a new announcement and assignment, and nobody else', async () => {
    const { course } = await makeCourse(api, instructor, [student, classmate]);
    await api.post(`/courses/${course.id}/announcements`, { as: instructor, body: { title: 'Room change' } });
    const made = await api.post(`/courses/${course.id}/assignments`, { as: instructor, body: { title: 'Essay' } });

    for (const who of [student, classmate]) {
      const seen = await titles(who);
      assert.ok(seen.includes(`New announcement in ${course.code}: Room change`), seen.join(' | '));
      assert.ok(seen.includes(`New assignment in ${course.code}: Essay`));
    }
    const forStudent = (await inbox(student)).notifications.find((n) => n.body === 'Essay');
    assert.equal(forStudent.link, `/courses/${course.id}/assignments/${made.data.assignment.id}`);
    assert.equal(forStudent.actorName, instructor.fullName);
    // Nobody is told about their own action, and outsiders hear nothing
    assert.equal((await titles(instructor)).some((t) => t.includes(course.code)), false);
    assert.equal((await titles(outsider)).some((t) => t.includes(course.code)), false);
  });

  it('says nothing to the students of a draft course', async () => {
    const { course } = await makeCourse(api, instructor, [student], { publish: false });
    await api.post(`/courses/${course.id}/announcements`, { as: instructor, body: { title: 'Draft news' } });
    assert.equal((await titles(student)).some((t) => t.includes('Draft news')), false);
  });

  it('tells a student when someone adds them to a course', async () => {
    const newcomer = await makeUser(api, 'student');
    const { course } = await makeCourse(api, instructor, [newcomer]);
    assert.ok((await titles(newcomer)).includes(`You were added to ${course.code}: ${course.title}`));
  });

  it('tells a student about a grade only once it is returned, and again if it changes', async () => {
    const { course } = await makeCourse(api, instructor, [student]);
    const assignment = (await api.post(`/courses/${course.id}/assignments`, { as: instructor, body: { title: 'Quiz 1' } })).data.assignment;
    const handedIn = await api.post(`/assignments/${assignment.id}/submission`, { as: student, form: fileForm([], { body: 'answers' }) });
    const id = handedIn.data.submission.id;
    const graded = async () => (await titles(student)).filter((t) => t.endsWith(': Quiz 1') && !t.startsWith('New'));

    await api.patch(`/submissions/${id}/grade`, { as: instructor, body: { score: 80 } });
    assert.deepEqual(await graded(), [], 'a grade still hidden from the student is not announced');
    assert.equal((await api.post(`/assignments/${assignment.id}/return-all`, { as: instructor })).data.returned, 1);
    assert.deepEqual(await graded(), ['Your work was graded: Quiz 1']);
    await api.patch(`/submissions/${id}/grade`, { as: instructor, body: { score: 90 } });
    assert.deepEqual(await graded(), ['Your grade was updated: Quiz 1', 'Your work was graded: Quiz 1']);
  });
});

describe('reading notifications', () => {
  it('counts unread ones, and marks one or all as read for their owner only', async () => {
    const { course } = await makeCourse(api, instructor, [classmate]);
    for (const title of ['One', 'Two']) {
      await api.post(`/courses/${course.id}/announcements`, { as: instructor, body: { title } });
    }
    const before = await inbox(classmate);
    assert.ok(before.unread >= 2);
    const first = before.notifications[0];

    assert.equal((await api.post(`/notifications/${first.id}/read`, { as: outsider })).status, 404);
    const marked = await api.post(`/notifications/${first.id}/read`, { as: classmate });
    assert.equal(marked.status, 200);
    assert.equal(marked.data.unread, before.unread - 1);
    assert.ok((await inbox(classmate)).notifications[0].readAt);

    assert.equal((await api.post('/notifications/read-all', { as: classmate })).data.unread, 0);
    assert.equal((await inbox(classmate)).unread, 0);
    assert.equal((await api.post('/notifications/no-such/read', { as: classmate })).status, 404);
  });

  it('needs a signed-in account', async () => {
    assert.equal((await api.get('/notifications')).status, 401);
  });
});
