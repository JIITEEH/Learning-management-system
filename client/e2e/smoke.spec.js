import { expect, test } from '@playwright/test';
import { expectNoSidewaysScroll, signIn, watchForProblems } from './support.js';

// Every role opens every screen it can reach, on a desktop and on a phone. A screen fails if it
// crashes, logs an error, gets a server error, or scrolls sideways. The server tests check what
// each role may do; this catches screens that break while drawing.
const ROLES = {
  student: ['/dashboard', '/courses', '/files', '/account'],
  instructor: ['/dashboard', '/courses', '/files', '/account'],
  admin: ['/dashboard', '/courses', '/files', '/account', '/admin', '/admin/users', '/admin/roles'],
};

for (const [role, paths] of Object.entries(ROLES)) {
  test(`${role}: every screen draws cleanly`, async ({ page }) => {
    const problems = watchForProblems(page);
    await signIn(page, role);
    for (const path of paths) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading').first(), `${path} shows a heading`).toBeVisible();
      await expectNoSidewaysScroll(page, path);
    }
    expect(problems).toEqual([]);
  });
}

test('signed-out screens draw cleanly, and private ones send you to sign in', async ({ page }) => {
  const problems = watchForProblems(page);
  for (const path of ['/', '/login', '/register', '/forgot-password', '/reset-password', '/no-such-page']) {
    await page.goto(path);
    await expect(page.getByRole('heading').first(), `${path} shows a heading`).toBeVisible();
    await expectNoSidewaysScroll(page, path);
  }
  await page.goto('/courses');
  await expect(page).toHaveURL(/\/login$/);
  expect(problems).toEqual([]);
});

test('a student cannot open the administration screens', async ({ page }) => {
  await signIn(page, 'student');
  await page.goto('/admin/users');
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('link', { name: 'Administration' })).toHaveCount(0);
});
