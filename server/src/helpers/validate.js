// Checks on values that arrive in a request body or URL. Each one returns the cleaned-up value,
// or throws a 400 that tells the person what to fix. Controllers use these instead of writing
// their own checks, so the same field is accepted or refused the same way everywhere.
import { HttpError } from './httpError.js';

// Text the person must fill in, trimmed. `max` should match the column's VARCHAR size.
export function requireText(value, label, { max = 200 } = {}) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new HttpError(400, `${label} is required`);
  if (text.length > max) throw new HttpError(400, `${label} must be ${max} characters or fewer`);
  return text;
}

// The longest lesson text accepted: about 25 printed pages, far past any single lesson
export const LESSON_TEXT_MAX = 50000;

// Text that may be left empty. Returns null when empty, which is what the database stores.
export function optionalText(value, label, { max = 200 } = {}) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new HttpError(400, `${label} must be text`);
  const text = value.trim();
  if (text.length > max) throw new HttpError(400, `${label} must be ${max} characters or fewer`);
  return text || null;
}

// Loose on purpose (the real test of an address is whether mail arrives), but it refuses spaces
// and line breaks: a line break inside an email header starts a new header, such as a hidden Bcc.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function requireEmail(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  // 254 is the longest address the email standard allows
  if (!EMAIL_SHAPE.test(email) || email.length > 254) {
    throw new HttpError(400, 'Enter a valid email address');
  }
  return email;
}

// bcrypt reads only the first 72 bytes of a password and silently ignores the rest, so a longer
// one would be weaker than it looks. Accented letters and emoji take 2 to 4 bytes each.
export function requirePassword(value, label = 'Password') {
  if (typeof value !== 'string' || value.length < 8) {
    throw new HttpError(400, `${label} must be at least 8 characters`);
  }
  if (Buffer.byteLength(value) > 72) throw new HttpError(400, `${label} must be 72 characters or fewer`);
  return value;
}

export function oneOf(value, allowed, label) {
  if (!allowed.includes(value)) {
    throw new HttpError(400, `${label} must be one of: ${allowed.join(', ')}`);
  }
  return value;
}

// An id from the URL, such as the 7 in /api/courses/7. Anything that is not a positive whole
// number cannot match a row, so it is answered as "not found" rather than sent to the database.
export function parseId(value, notFoundMessage = 'Not found') {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, notFoundMessage);
  return id;
}

// A date and time that may be left empty, such as a due date. It must say its time zone (the
// browser sends e.g. '2026-10-01T07:00:00.000Z'), so "3 pm" can never be misread as another
// zone's 3 pm. Returns MySQL's format in UTC ('2026-10-01 07:00:00'), or null when empty.
export function optionalDateTime(value, label) {
  if (value === undefined || value === null || value === '') return null;
  const hasZone = typeof value === 'string' && /(Z|[+-]\d{2}:\d{2})$/.test(value);
  const date = hasZone ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    throw new HttpError(400, `${label} must be a date and time with its time zone`);
  }
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

// A number within a range, such as a maximum score
export function requireNumber(value, label, { min, max }) {
  const number = typeof value === 'number' ? value : Number(value);
  if (value === '' || value === null || !Number.isFinite(number) || number < min || number > max) {
    throw new HttpError(400, `${label} must be a number from ${min} to ${max}`);
  }
  return number;
}
