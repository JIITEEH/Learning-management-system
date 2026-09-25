// Turning stored values (codes, timestamps) into what a person reads.

const ROLE_LABELS = { admin: 'Administrator', instructor: 'Instructor', student: 'Student' };
const ACCOUNT_STATUS = {
  active: { label: 'Active', tone: 'tag-ok' },
  pending: { label: 'Awaiting approval', tone: 'tag-warn' },
  suspended: { label: 'Suspended', tone: '' },
};
const COURSE_STATUS = {
  draft: { label: 'Draft', tone: 'tag-info' },
  published: { label: 'Open', tone: 'tag-ok' },
  archived: { label: 'Archived', tone: '' },
};
const RELATION_LABELS = { teaching: 'You teach this', enrolled: 'Enrolled', overseeing: 'Administrator view' };

export const roleLabel = (role) => ROLE_LABELS[role] ?? role;
export const accountStatus = (status) => ACCOUNT_STATUS[status] ?? { label: status, tone: '' };
export const courseStatus = (status) => COURSE_STATUS[status] ?? { label: status, tone: '' };
export const relationLabel = (relation) => RELATION_LABELS[relation] ?? relation;

// 2048 -> "2 KB", 5300000 -> "5.1 MB"
export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// "1 student", "3 students"
export const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

// ABCDEFGH is shown as ABCD-EFGH, which is easier to read out to a class
export const formatJoinCode = (code) => (code ? `${code.slice(0, 4)}-${code.slice(4)}` : '');

// "Maria Dela Cruz" -> "MC": the first letters of the first and last words
export function initials(fullName) {
  const words = String(fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (words[0][0] + last).toUpperCase();
}

// The server sends times in UTC as 'YYYY-MM-DD HH:MM:SS' (MySQL's format). Turned into
// 'YYYY-MM-DDTHH:MM:SSZ', which every browser reads (Safari cannot read the space) and which says
// "this is UTC" (the Z), so toLocale...String() below shows the viewer's own local time.
function parseTimestamp(value) {
  const date = new Date(`${String(value).replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

// "25 Sept 2026": the viewer's own date style, month in words so 9/10 cannot be misread
export function formatDate(value) {
  return parseTimestamp(value)?.toLocaleDateString(undefined, { dateStyle: 'medium' }) ?? '—';
}

// "25 Sept 2026, 5:48 PM": minutes are enough for anything a person reads here
export function formatDateTime(value) {
  return parseTimestamp(value)?.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) ?? '—';
}

// A due date for display: "Thu, 1 Jan 2030, 9:00 AM" in the viewer's own time zone
export function formatDue(value) {
  const date = value ? parseTimestamp(value) : null;
  if (!date) return 'No due date';
  return date.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// Whether a due date has passed, by the viewer's clock. For display only: the server decides
// lateness by its own clock when work is handed in.
export const isPastDue = (value) => Boolean(value) && parseTimestamp(value) < new Date();

// An <input type="datetime-local"> works in the viewer's local time with no zone ('2030-01-01T09:00').
// These convert between that and the server's UTC.
export function toLocalInput(value) {
  const date = value ? parseTimestamp(value) : null;
  if (!date) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

// '2030-01-01T09:00' typed in Manila becomes '2030-01-01T01:00:00.000Z'; empty stays empty
export const fromLocalInput = (value) => (value ? new Date(value).toISOString() : null);
