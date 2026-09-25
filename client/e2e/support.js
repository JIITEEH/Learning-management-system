// Shared by the browser tests
import { expect } from '@playwright/test';
import { ACCOUNTS, PASSWORD } from './settings.mjs';

// Collects everything that should fail a screen, for the page's whole life: a crash, an error in
// the console, or a server error. (The browser also logs expected 4xx answers as "Failed to load
// resource"; those are the server correctly saying no, so they are not problems.)
export function watchForProblems(page) {
  const problems = [];
  page.on('pageerror', (error) => problems.push(`Crash: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) {
      problems.push(`Console error: ${message.text()}`);
    }
  });
  page.on('response', (response) => {
    if (response.status() >= 500) problems.push(`Server error ${response.status()}: ${response.url()}`);
  });
  return problems;
}

export async function signIn(page, who) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(ACCOUNTS[who].email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

// Nothing wider than the screen, so a phone never scrolls sideways
export async function expectNoSidewaysScroll(page, where) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${where} scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(0);
}
