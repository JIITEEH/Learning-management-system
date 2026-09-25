import { expect, test } from '@playwright/test';
import { signIn, watchForProblems } from './support.js';

// One course from start to finish, with each person in their own browser: the instructor sets it
// up, a student works through it, the instructor grades, the student sees the result. Runs once,
// on a desktop screen.
test('a course from setup to returned grade', async ({ browser }) => {
  const instructor = await (await browser.newContext()).newPage();
  const student = await (await browser.newContext()).newPage();
  const classmate = await (await browser.newContext()).newPage();
  const problems = [instructor, student, classmate].map(watchForProblems);
  const tab = (page, name) => page.getByRole('tab', { name }).click();

  // The instructor creates and opens a course
  await signIn(instructor, 'instructor');
  await instructor.goto('/courses');
  await instructor.getByRole('button', { name: 'New course' }).click();
  await instructor.getByLabel('Course code').fill('E2E101');
  await instructor.getByLabel('Title').fill('Journey course');
  await instructor.getByRole('button', { name: 'Create course' }).click();
  await expect(instructor.getByRole('heading', { name: 'Journey course' })).toBeVisible();
  const coursePath = new URL(instructor.url()).pathname;
  await instructor.getByLabel('Who can see this course').selectOption('published');
  await instructor.getByRole('button', { name: 'Save status' }).click();
  await expect(instructor.getByText('Open', { exact: true })).toBeVisible();
  const joinCode = (await instructor.locator('.join-code').textContent()).trim();

  // ...adds a lesson with text and a file
  await tab(instructor, 'Lessons');
  await instructor.getByLabel('New module title').fill('Week 1');
  await instructor.getByRole('button', { name: 'Add module' }).click();
  await instructor.getByLabel('New lesson title').fill('Getting started');
  await instructor.getByRole('button', { name: 'Add lesson' }).click();
  await instructor.getByRole('button', { name: 'Edit lesson' }).click();
  await instructor.getByLabel('Text').fill('Welcome.\n\nRead https://example.com/guide first. <b>not bold</b>');
  await instructor.getByRole('button', { name: 'Save lesson' }).click();
  await expect(instructor.getByRole('link', { name: 'https://example.com/guide' })).toBeVisible();
  await expect(instructor.getByText('<b>not bold</b>')).toBeVisible();
  await instructor.getByLabel('Add files').setInputFiles({ name: 'handout.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 handout') });
  await instructor.getByRole('button', { name: 'Upload' }).click();
  await expect(instructor.getByRole('link', { name: 'handout.pdf' })).toBeVisible();

  // ...sets an assignment and posts an announcement
  await instructor.goto(coursePath);
  await tab(instructor, 'Assignments');
  await instructor.getByRole('button', { name: 'New assignment' }).click();
  await instructor.getByLabel('Title').fill('First essay');
  await instructor.getByLabel('Maximum score').fill('50');
  await instructor.getByRole('button', { name: 'Create assignment' }).click();
  await expect(instructor.getByRole('heading', { name: 'First essay' })).toBeVisible();
  const assignmentPath = new URL(instructor.url()).pathname;
  await instructor.goto(coursePath);
  await tab(instructor, 'Announcements');
  await instructor.getByLabel('Title').fill('Welcome to the course');
  await instructor.getByRole('button', { name: 'Post announcement' }).click();
  await expect(instructor.getByRole('heading', { name: 'Welcome to the course' })).toBeVisible();

  // A student joins, reads the lesson, marks it done and hands in
  await signIn(student, 'student');
  await student.goto('/courses');
  await student.getByLabel('Join code').fill(joinCode.toLowerCase());
  await student.getByRole('button', { name: 'Join' }).click();
  await expect(student.getByRole('link', { name: /Journey course/ })).toBeVisible();
  await student.goto(coursePath);
  await tab(student, 'Lessons');
  await student.getByRole('link', { name: 'Getting started' }).click();
  await expect(student.getByRole('button', { name: 'Edit lesson' })).toHaveCount(0);
  await student.getByRole('button', { name: 'Mark as done' }).click();
  await expect(student.getByRole('button', { name: /Mark as not done/ })).toBeVisible();
  await student.goto(assignmentPath);
  await student.getByLabel('Written answer').fill('My essay about the course.');
  await student.getByRole('button', { name: 'Hand in', exact: true }).click();
  await expect(student.getByText('Handed in', { exact: true })).toBeVisible();

  // A classmate in another course cannot open any of it
  await signIn(classmate, 'classmate');
  await classmate.goto(assignmentPath);
  await expect(classmate.getByRole('heading', { name: 'Assignment not found' })).toBeVisible();

  // The instructor grades; the student sees nothing until it is returned
  await instructor.goto(assignmentPath);
  await instructor.getByRole('button', { name: /Sam Student's work/ }).click();
  await instructor.getByLabel(/Score/).fill('45');
  await instructor.getByLabel('Feedback').fill('Clear and well organised.');
  await instructor.getByRole('button', { name: 'Save grade' }).click();
  await expect(instructor.getByText('Graded 45/50')).toBeVisible();
  await student.reload();
  await expect(student.getByText('Marked, not returned yet')).toBeVisible();
  await expect(student.getByText('Clear and well organised.')).toHaveCount(0);
  await instructor.getByRole('button', { name: /Return all graded/ }).click();
  await student.reload();
  await expect(student.getByText('Clear and well organised.')).toBeVisible();

  // The dashboards reflect all of it
  await student.goto('/dashboard');
  await expect(student.getByText('45/50')).toBeVisible();
  await expect(student.getByRole('link', { name: /Welcome to the course/ })).toBeVisible();
  await instructor.goto(coursePath);
  await tab(instructor, 'Gradebook');
  await expect(instructor.getByText('45/50 (90%)')).toBeVisible();

  expect(problems.flat()).toEqual([]);
});
