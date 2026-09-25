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

export function formatDate(value) {
  return parseTimestamp(value)?.toLocaleDateString() ?? '—';
}

export function formatDateTime(value) {
  return parseTimestamp(value)?.toLocaleString() ?? '—';
}
