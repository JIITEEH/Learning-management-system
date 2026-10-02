import './setup.js';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { daysFromNow, fileForm, makeCourse, makeUser, startApi } from './helpers.js';
import { sendDeadlineReminders } from '../src/database/reminders.js';

const api = await startApi();
const hoursFromNow = (hours) => daysFromNow(hours / 24);

// Runs the job, collecting the emails it would send instead of sending them
async function run() {
  const emails = [];
  const summary = await sendDeadlineReminders({ send: async (message) => emails.push(message) });
  return { summary, emails };
}

const remindersFor = async (who) =>
  (await api.get('/notifications', { as: who })).data.notifications.filter((n) => n.title.includes('within a day') || n.title.includes('overdue'));

describe('deadline reminders', () => {
  it('reminds only students who still owe the work, once each, and again when a deadline moves', async () => {
    const instructor = await makeUser(api, 'instructor');
    const student = await makeUser(api, 'student', 'Rita Reminded');
    const finished = await makeUser(api, 'student');
    const { course } = await makeCourse(api, instructor, [student, finished]);
    const assign = async (title, dueAt) =>
      (await api.post(`/courses/${course.id}/assignments`, { as: instructor, body: { title, dueAt } })).data.assignment;

    const soon = await assign('Soon essay', hoursFromNow(5));
    await assign('Far essay', hoursFromNow(72));
    await assign('Late essay', hoursFromNow(-48));
    await assign('Ancient essay', hoursFromNow(-24 * 10));
    // One student has already handed in the soon one
    await api.post(`/assignments/${soon.id}/submission`, { as: finished, form: fileForm([], { body: 'done' }) });

    const quiz = (await api.post(`/courses/${course.id}/quizzes`, { as: instructor, body: { title: 'Soon quiz', dueAt: hoursFromNow(5) } })).data.quiz;
    await api.post(`/quizzes/${quiz.id}/questions`, { as: instructor, body: { kind: 'true_false', prompt: 'Yes?', answer: true } });
    await api.patch(`/quizzes/${quiz.id}`, { as: instructor, body: { isPublished: true } });
    const hidden = (await api.post(`/courses/${course.id}/quizzes`, { as: instructor, body: { title: 'Hidden quiz', dueAt: hoursFromNow(5) } })).data.quiz;
    assert.ok(hidden.id);

    const first = await run();
    const titles = (await remindersFor(student)).map((n) => n.title).sort();
    assert.deepEqual(titles, ['Late essay is overdue', 'Soon essay is due within a day', 'Soon quiz closes within a day']);
    assert.deepEqual((await remindersFor(finished)).map((n) => n.title).sort(), ['Late essay is overdue', 'Soon quiz closes within a day']);
    assert.equal(first.summary.reminders, 5);
    assert.equal((await remindersFor(instructor)).length, 0, 'whoever teaches the course is not reminded');

    const email = first.emails.find((message) => message.to === student.email && message.subject.includes('Soon essay'));
    assert.equal(email.subject, 'LearnHub: Soon essay is due within a day');
    assert.match(email.text, /Hello Rita Reminded/);
    assert.match(email.text, new RegExp(`/courses/${course.id}/assignments/${soon.id}`));

    // Nothing twice, however often it runs
    assert.equal((await run()).summary.reminders, 0);

    // A moved deadline is a new deadline
    await api.patch(`/assignments/${soon.id}`, { as: instructor, body: { dueAt: hoursFromNow(10) } });
    assert.equal((await run()).summary.reminders, 1);
  });

  it('leaves out draft courses and students who dropped the course', async () => {
    const instructor = await makeUser(api, 'instructor');
    const student = await makeUser(api, 'student');
    const { course: draft } = await makeCourse(api, instructor, [student], { publish: false });
    await api.post(`/courses/${draft.id}/assignments`, { as: instructor, body: { title: 'Draft work', dueAt: hoursFromNow(5) } });

    const { course } = await makeCourse(api, instructor, [student]);
    const roster = (await api.get(`/courses/${course.id}/roster`, { as: instructor })).data.enrollments;
    assert.equal((await api.patch(`/enrollments/${roster[0].id}`, { as: instructor, body: { status: 'dropped' } })).status, 200);
    await api.post(`/courses/${course.id}/assignments`, { as: instructor, body: { title: 'Dropped work', dueAt: hoursFromNow(5) } });

    await run();
    assert.deepEqual(await remindersFor(student), []);
  });
});
