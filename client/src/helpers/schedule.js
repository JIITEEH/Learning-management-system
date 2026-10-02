// Calendar arithmetic for weekly class meetings. Meetings are school clock time, so everything
// here works in the browser's local calendar (a school's students are in the school's time zone).

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
// The order days are shown in: a school week starts on Monday
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

// A local date as 'YYYY-MM-DD', the same form the server uses for a meeting's first and last date
export function dayString(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

// The Monday of the week a date falls in
export function mondayOf(date) {
  const offset = (date.getDay() + 6) % 7; // Monday 0 … Sunday 6
  return addDays(new Date(date.getFullYear(), date.getMonth(), date.getDate()), -offset);
}

// The meetings that take place on one date: the right weekday, and within their date range
export function meetingsOn(date, meetings) {
  const day = dayString(date);
  return meetings
    .filter((m) => m.dayOfWeek === date.getDay() && m.effectiveFrom <= day && (!m.effectiveTo || day <= m.effectiveTo))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

// '13:30' shown the viewer's way, e.g. "1:30 PM"
export function formatTime(value) {
  const [hours, minutes] = value.split(':').map(Number);
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

// Where a deadline from /schedules/deadlines opens: its assignment or its quiz
export const deadlineLink = (deadline) =>
  `/courses/${deadline.courseId}/${deadline.kind === 'quiz' ? 'quizzes' : 'assignments'}/${deadline.id}`;

export const timeRange = (meeting) => `${formatTime(meeting.startsAt)} – ${formatTime(meeting.endsAt)}`;

// The days a month calendar shows: whole weeks, Monday to Sunday, from the week the month starts in
// to the week it ends in (35 or 42 days, sometimes 28). `month` is any date in that month.
export function monthGrid(month) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const start = mondayOf(first);
  const weeks = Math.round((mondayOf(last) - start) / (7 * 86400000)) + 1;
  return Array.from({ length: weeks * 7 }, (_, index) => addDays(start, index));
}
