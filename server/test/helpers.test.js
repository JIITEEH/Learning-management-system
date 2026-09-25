// The small shared tools, tested on their own: no server or database needed
import './setup.js';
import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { pool } from '../src/database/index.js';
import { toCsv } from '../src/helpers/csv.js';
import { totalFor } from '../src/helpers/grades.js';
import { optionalDateTime, parseId, requireEmail, requireNumber, requirePassword } from '../src/helpers/validate.js';

after(async () => {
  await pool.query(`DROP DATABASE IF EXISTS \`${process.env.DB_NAME}\``);
  await pool.end();
});

describe('grade totals', () => {
  const now = '2026-06-01 00:00:00';
  const past = { id: 1, due_at: '2026-01-01 00:00:00', max_score: '50.00' };
  const future = { id: 2, due_at: '2027-01-01 00:00:00', max_score: '20.00' };
  const undated = { id: 3, due_at: null, max_score: '10.00' };
  const assignments = [past, future, undated];

  it('counts scores out of their maximum', () => {
    const scores = { 1: 40, 2: 15, 3: 5 };
    assert.deepEqual(totalFor(assignments, (a) => scores[a.id], now), { earned: 60, possible: 80, percent: 75 });
  });

  it('counts nothing handed in as 0 once past due, and leaves out what is not due yet', () => {
    assert.deepEqual(totalFor(assignments, () => null, now), { earned: 0, possible: 50, percent: 0 });
  });

  it('leaves out work handed in but not graded, even past due', () => {
    assert.deepEqual(totalFor(assignments, () => 'waiting', now), { earned: 0, possible: 0, percent: null });
  });
});

describe('CSV', () => {
  it('turns cells a spreadsheet would run into text, and quotes commas and quotes', () => {
    const csv = toCsv([{ header: 'Name', value: (row) => row.name }], [{ name: '=1+1' }, { name: '+1' }, { name: '@SUM(A1)' }, { name: 'Dela Cruz, "Ana"' }]);
    const lines = csv.replace('﻿', '').trim().split('\r\n');
    assert.deepEqual(lines, ['Name', "'=1+1", "'+1", "'@SUM(A1)", '"Dela Cruz, ""Ana"""']);
  });
});

describe('input checks', () => {
  it('reads due dates with a time zone into UTC, and refuses one without', () => {
    assert.equal(optionalDateTime('2030-01-01T09:00:00+08:00', 'Due'), '2030-01-01 01:00:00');
    assert.equal(optionalDateTime('', 'Due'), null);
    assert.throws(() => optionalDateTime('2030-01-01 09:00', 'Due'), { status: 400 });
    assert.throws(() => optionalDateTime('not a date Z', 'Due'), { status: 400 });
  });

  it('refuses emails with spaces or line breaks', () => {
    assert.equal(requireEmail('  Ana@Example.test '), 'ana@example.test');
    assert.throws(() => requireEmail('a@b.test\nBcc: x@y.test'), { status: 400 });
    assert.throws(() => requireEmail('no-at-sign'), { status: 400 });
  });

  it('counts a password\'s length in bytes, the way the password hashing does', () => {
    assert.equal(requirePassword('a'.repeat(72)), 'a'.repeat(72));
    assert.throws(() => requirePassword('é'.repeat(40)), { status: 400 }, '40 accented letters are 80 bytes');
  });

  it('treats a bad id as "not found" and keeps numbers in range', () => {
    for (const bad of ['abc', '-1', '0', '1.5', '']) assert.throws(() => parseId(bad), { status: 404 });
    assert.equal(parseId('7'), 7);
    assert.throws(() => requireNumber('51', 'Score', { min: 0, max: 50 }), { status: 400 });
    assert.equal(requireNumber('7.5', 'Score', { min: 0, max: 50 }), 7.5);
  });
});
