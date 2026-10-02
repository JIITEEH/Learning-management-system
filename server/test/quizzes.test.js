import './setup.js';
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { daysFromNow, makeCourse, makeUser, startApi } from './helpers.js';
import { query } from '../src/database/index.js';
import { markAnswer, normalise } from '../src/helpers/quizMarking.js';

const api = await startApi();

let instructor;
let student;
let classmate;
let outsider;
let course;

before(async () => {
  instructor = await makeUser(api, 'instructor');
  student = await makeUser(api, 'student');
  classmate = await makeUser(api, 'student');
  outsider = await makeUser(api, 'student');
  ({ course } = await makeCourse(api, instructor, [student, classmate]));
});

const QUESTIONS = {
  single: { kind: 'single', prompt: 'Capital of France?', points: 2, options: [{ label: 'Paris', isCorrect: true }, { label: 'Lyon' }] },
  multiple: {
    kind: 'multiple', prompt: 'Which are prime?', points: 3,
    options: [{ label: '2', isCorrect: true }, { label: '3', isCorrect: true }, { label: '4' }],
  },
  trueFalse: { kind: 'true_false', prompt: 'The sun is a star.', answer: true },
  short: { kind: 'short', prompt: 'Largest ocean?', acceptedAnswers: ['Pacific', 'Pacific Ocean'] },
};

// A quiz with the four kinds of question, published unless told otherwise
async function makeQuiz(settings = {}, { publish = true, courseId = course.id } = {}) {
  const quiz = (await api.post(`/courses/${courseId}/quizzes`, { as: instructor, body: { title: 'Quiz', ...settings } })).data.quiz;
  const questions = [];
  for (const body of Object.values(QUESTIONS)) {
    const res = await api.post(`/quizzes/${quiz.id}/questions`, { as: instructor, body });
    assert.equal(res.status, 201, JSON.stringify(res.data));
    questions.push(res.data.question);
  }
  if (publish) assert.equal((await api.patch(`/quizzes/${quiz.id}`, { as: instructor, body: { isPublished: true } })).status, 200);
  return { quiz, questions };
}

// The right answer to each question, from the instructor's copy
function rightAnswers(questions) {
  return questions.map((question) =>
    question.kind === 'short'
      ? { questionId: question.id, text: '  pacific  OCEAN ' }
      : { questionId: question.id, optionIds: question.options.filter((option) => option.isCorrect).map((option) => option.id) },
  );
}

const start = (quiz, who = student) => api.post(`/quizzes/${quiz.id}/attempts`, { as: who });
const submit = (attempt, answers, who = student) => api.post(`/attempts/${attempt.id}/submit`, { as: who, body: { answers } });

describe('marking', () => {
  it('compares typed answers ignoring capitals and extra spaces', () => {
    assert.equal(normalise('  New   York '), 'new york');
    const question = { id: 1, kind: 'short', points: '1.00' };
    assert.equal(markAnswer(question, [{ id: 9, label: 'New York' }], { text: 'new york' }).isCorrect, true);
    assert.equal(markAnswer(question, [{ id: 9, label: 'New York' }], { text: '' }).isCorrect, false);
  });

  it('gives a multiple choice question nothing unless every right option and no wrong one is chosen', () => {
    const question = { id: 1, kind: 'multiple', points: '3.00' };
    const options = [{ id: 1, is_correct: 1 }, { id: 2, is_correct: 1 }, { id: 3, is_correct: 0 }];
    assert.equal(markAnswer(question, options, { optionIds: [1, 2] }).pointsAwarded, 3);
    assert.equal(markAnswer(question, options, { optionIds: [1] }).pointsAwarded, 0);
    assert.equal(markAnswer(question, options, { optionIds: [1, 2, 3] }).pointsAwarded, 0);
    // An option id from some other question is ignored, not counted
    assert.equal(markAnswer(question, options, { optionIds: [1, 2, 99] }).pointsAwarded, 3);
  });
});

describe('building a quiz', () => {
  it('refuses questions that cannot be marked', async () => {
    const quiz = (await api.post(`/courses/${course.id}/quizzes`, { as: instructor, body: { title: 'Checks' } })).data.quiz;
    const bad = [
      { ...QUESTIONS.single, options: [{ label: 'A', isCorrect: true }, { label: 'B', isCorrect: true }] },
      { ...QUESTIONS.single, options: [{ label: 'Only one', isCorrect: true }] },
      { ...QUESTIONS.multiple, options: [{ label: 'A' }, { label: 'B' }] },
      { ...QUESTIONS.short, acceptedAnswers: [] },
      { kind: 'true_false', prompt: 'No answer given' },
      { ...QUESTIONS.single, kind: 'essay' },
    ];
    for (const body of bad) assert.equal((await api.post(`/quizzes/${quiz.id}/questions`, { as: instructor, body })).status, 400);
    assert.equal((await api.patch(`/quizzes/${quiz.id}`, { as: instructor, body: { isPublished: true } })).status, 409, 'no questions yet');
  });

  it('lets only the course\'s instructor build one, and hides it from students until published', async () => {
    assert.equal((await api.post(`/courses/${course.id}/quizzes`, { as: student, body: { title: 'x' } })).status, 403);
    const { quiz } = await makeQuiz({}, { publish: false });
    assert.equal((await api.get(`/quizzes/${quiz.id}`, { as: student })).status, 404);
    assert.equal((await api.get(`/courses/${course.id}/quizzes`, { as: student })).data.quizzes.some((q) => q.id === quiz.id), false);
    assert.equal((await api.get(`/quizzes/${quiz.id}`, { as: outsider })).status, 404);

    await api.patch(`/quizzes/${quiz.id}`, { as: instructor, body: { isPublished: true } });
    assert.equal((await api.get(`/quizzes/${quiz.id}`, { as: student })).status, 200);
    const told = (await api.get('/notifications', { as: student })).data.notifications;
    assert.ok(told.some((n) => n.link === `/courses/${course.id}/quizzes/${quiz.id}`));
  });
});

describe('the answers stay on the server', () => {
  it('sends a student the questions without saying which options are right', async () => {
    const { quiz } = await makeQuiz();
    const asStudent = await api.get(`/quizzes/${quiz.id}`, { as: student });
    assert.equal(asStudent.data.questions, undefined);

    const started = await start(quiz);
    assert.equal(started.status, 201);
    const raw = JSON.stringify(started.data);
    assert.equal(raw.includes('isCorrect'), false);
    assert.equal(raw.includes('Pacific'), false, 'the accepted short answers are not sent');
    assert.deepEqual(started.data.questions.find((q) => q.kind === 'short').options, []);
  });
});

describe('taking a quiz', () => {
  it('marks a handed-in attempt and shows which questions were right, but not the answers', async () => {
    const { quiz, questions } = await makeQuiz({ maxAttempts: 2 });
    const attempt = (await start(quiz)).data.attempt;
    const answers = rightAnswers(questions);
    answers[1].optionIds = answers[1].optionIds.slice(0, 1); // only one of the two primes
    const result = await submit(attempt, answers);
    assert.equal(result.status, 200);
    assert.equal(result.data.attempt.score, 2 + 1 + 1);
    assert.equal(result.data.attempt.maxScore, 2 + 3 + 1 + 1);
    assert.deepEqual(result.data.questions.map((q) => q.isCorrect), [true, false, true, true]);
    assert.equal(JSON.stringify(result.data).includes('isCorrect":true,"label'), false);
    assert.equal(result.data.questions[0].options.some((option) => 'isCorrect' in option), false);

    assert.equal((await submit(attempt, answers)).status, 409, 'cannot hand in twice');
    assert.equal((await api.get(`/attempts/${attempt.id}`, { as: classmate })).status, 404, 'nobody else can read it');

    // A second try, all right: the best of the two counts
    const second = (await start(quiz)).data.attempt;
    assert.equal(second.attemptNumber, 2);
    assert.equal((await submit(second, rightAnswers(questions))).data.attempt.score, 7);
    assert.equal((await start(quiz)).status, 409, 'no attempts left');
    const listed = (await api.get(`/courses/${course.id}/quizzes`, { as: student })).data.quizzes.find((q) => q.id === quiz.id);
    assert.deepEqual([listed.attemptsUsed, listed.bestScore], [2, 7]);

    const results = (await api.get(`/quizzes/${quiz.id}/results`, { as: instructor })).data.students;
    assert.deepEqual(results.find((row) => row.userId === student.id).bestScore, 7);
    assert.equal((await api.get(`/quizzes/${quiz.id}/results`, { as: student })).status, 403);
  });

  it('carries on with an open attempt rather than starting another', async () => {
    const { quiz } = await makeQuiz();
    const first = (await start(quiz)).data.attempt;
    assert.equal((await start(quiz)).data.attempt.id, first.id);
  });

  it('lets only students taking the course start one', async () => {
    const { quiz } = await makeQuiz();
    assert.equal((await start(quiz, instructor)).status, 403);
    assert.equal((await start(quiz, outsider)).status, 404);
  });

  it('refuses to start a closed quiz', async () => {
    const { quiz } = await makeQuiz({ dueAt: daysFromNow(-1) });
    const res = await start(quiz);
    assert.equal(res.status, 409);
    assert.match(res.data.error, /closed/);
  });

  it('counts nothing handed in after the time is up', async () => {
    const { quiz, questions } = await makeQuiz({ timeLimitMinutes: 10 });
    const attempt = (await start(quiz, classmate)).data.attempt;
    assert.ok(attempt.endsAt);
    // As if the ten minutes and the minute of grace had passed
    await query('UPDATE quiz_attempts SET ends_at = UTC_TIMESTAMP() - INTERVAL 2 MINUTE WHERE id = :id', { id: attempt.id });
    const late = await submit(attempt, rightAnswers(questions), classmate);
    assert.equal(late.status, 409);
    assert.match(late.data.error, /Time ran out/);
    assert.equal((await api.get(`/attempts/${attempt.id}`, { as: classmate })).data.attempt.score, 0);
  });

  it('fixes the questions once someone has started', async () => {
    const { quiz, questions } = await makeQuiz();
    await start(quiz);
    assert.equal((await api.post(`/quizzes/${quiz.id}/questions`, { as: instructor, body: QUESTIONS.single })).status, 409);
    assert.equal((await api.delete(`/quiz-questions/${questions[0].id}`, { as: instructor })).status, 409);
    assert.equal((await api.patch(`/quizzes/${quiz.id}`, { as: instructor, body: { isPublished: false } })).status, 409);
    // Settings other than the questions may still change
    assert.equal((await api.patch(`/quizzes/${quiz.id}`, { as: instructor, body: { title: 'Renamed' } })).status, 200);
  });
});

describe('quiz scores in the grades', () => {
  it('count the best score, and 0 for a closed quiz never taken, in the gradebook and the student\'s own total alike', async () => {
    const learner = await makeUser(api, 'student');
    const { course: graded } = await makeCourse(api, instructor, [learner]);
    const { quiz, questions } = await makeQuiz({ maxAttempts: 2 }, { courseId: graded.id });
    await submit((await start(quiz, learner)).data.attempt, [], learner);
    await submit((await start(quiz, learner)).data.attempt, rightAnswers(questions), learner);
    await makeQuiz({ dueAt: daysFromNow(-1) }, { courseId: graded.id });
    await makeQuiz({}, { courseId: graded.id, publish: false });

    const book = (await api.get(`/courses/${graded.id}/gradebook`, { as: instructor })).data;
    assert.equal(book.quizzes.length, 2, 'an unpublished quiz is not a column');
    const row = book.students.find((student) => student.userId === learner.id);
    // Soonest closing first: the closed quiz, then the one taken
    assert.deepEqual(row.quizCells.map((cell) => cell.score), [null, 7]);
    assert.deepEqual(row.total, { earned: 7, possible: 14, percent: 50 });

    const own = (await api.get(`/courses/${graded.id}/assignments`, { as: learner })).data.myTotal;
    assert.deepEqual(own, row.total);
    const csv = await api.get(`/courses/${graded.id}/gradebook.csv`, { as: instructor });
    assert.ok(csv.data.startsWith('Student,Email,Quiz: Quiz (/7),Quiz: Quiz (/7),Points earned'), csv.data);
    assert.ok(csv.data.includes(',missing,7,7,14,50'), csv.data);
  });
});

describe('deleting', () => {
  const count = async (table) => Number((await query(`SELECT COUNT(*) AS n FROM ${table}`))[0].n);

  it('removes every question, option, attempt and answer with the course or the account', async () => {
    const tables = ['quizzes', 'quiz_questions', 'quiz_options', 'quiz_attempts', 'quiz_answers'];
    const before = await Promise.all(tables.map(count));

    const temporary = await makeUser(api, 'student');
    const { course: doomed } = await makeCourse(api, instructor, [temporary]);
    const { quiz, questions } = await makeQuiz({}, { courseId: doomed.id });
    await submit((await start(quiz, temporary)).data.attempt, rightAnswers(questions), temporary);

    const admin = await makeUser(api, 'admin');
    assert.equal((await api.delete(`/users/${temporary.id}`, { as: admin })).status, 204);
    assert.equal(await count('quiz_attempts'), before[3]);
    assert.equal(await count('quiz_answers'), before[4]);

    await api.patch(`/courses/${doomed.id}/status`, { as: instructor, body: { status: 'archived' } });
    assert.equal((await api.delete(`/courses/${doomed.id}`, { as: admin })).status, 204);
    assert.deepEqual(await Promise.all(tables.map(count)), before);
  });
});
