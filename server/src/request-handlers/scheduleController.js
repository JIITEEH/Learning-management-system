// Weekly class meetings: a course's list, adding, editing and removing them, and a person's own
// timetable across all their courses, and the deadlines that go on their month calendar.
// Overlapping meetings in one course are allowed (a split lab
// is on purpose) but the reply carries a warning naming what it overlaps.
import * as Assignment from '../database-queries/assignmentModel.js';
import * as Quiz from '../database-queries/quizModel.js';
import * as Schedule from '../database-queries/scheduleModel.js';
import { nowUtc } from '../helpers/grades.js';
import { HttpError } from '../helpers/httpError.js';
import { optionalDateTime, optionalText, parseId, readDay, requireNumber, requireTime } from '../helpers/validate.js';
import { manageCourse, reachCourse } from '../permission-rules/access.js';
import { isLate } from './assignmentController.js';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function toJson(row) {
  return {
    id: row.id,
    courseId: row.course_id,
    title: row.title,
    dayOfWeek: row.day_of_week,
    // '09:00:00' from MySQL is shown as '09:00'
    startsAt: row.starts_at.slice(0, 5),
    endsAt: row.ends_at.slice(0, 5),
    location: row.location,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    ...(row.course_code ? { courseCode: row.course_code, courseTitle: row.course_title } : {}),
  };
}

// Reads a meeting from the request. When editing, a field left out keeps its current value.
function readMeeting(body = {}, current = null) {
  const pick = (field, read) => (body[field] === undefined && current ? current[field] : read(body[field]));
  const meeting = {
    title: pick('title', (value) => optionalText(value, 'Title', { max: 200 })),
    dayOfWeek: pick('dayOfWeek', (value) => requireNumber(value, 'Day', { min: 0, max: 6 })),
    startsAt: pick('startsAt', (value) => requireTime(value, 'Start time')),
    endsAt: pick('endsAt', (value) => requireTime(value, 'End time')),
    location: pick('location', (value) => optionalText(value, 'Room or place', { max: 160 })),
    effectiveFrom: pick('effectiveFrom', (value) => readDay(value, 'First date', { required: true })),
    effectiveTo: pick('effectiveTo', (value) => readDay(value, 'Last date')),
  };
  if (!Number.isInteger(meeting.dayOfWeek)) throw new HttpError(400, 'Day must be a whole number from 0 (Sunday) to 6');
  if (meeting.endsAt <= meeting.startsAt) throw new HttpError(400, 'A class must end after it starts');
  if (meeting.effectiveTo && meeting.effectiveTo < meeting.effectiveFrom) {
    throw new HttpError(400, 'The last date cannot be before the first date');
  }
  return meeting;
}

// "Overlaps Lecture (Monday 09:00–10:30)" for each clashing meeting
async function clashWarnings(meeting) {
  const clashes = await Schedule.clashesWith(meeting);
  return clashes.map(
    (row) => `Overlaps ${row.title ?? 'another class'} (${DAY_NAMES[row.day_of_week]} ${row.starts_at.slice(0, 5)}–${row.ends_at.slice(0, 5)})`,
  );
}

// The meeting named in the URL, after checking the requester manages its course
async function findManagedMeeting(req) {
  const meeting = await Schedule.findById(parseId(req.params.id, 'Class meeting not found'));
  if (!meeting) throw new HttpError(404, 'Class meeting not found');
  await manageCourse(req, meeting.course_id);
  return meeting;
}

export async function listCourseSchedule(req, res) {
  const { course } = await reachCourse(req, req.params.id);
  res.json({ schedules: (await Schedule.listForCourse(course.id)).map(toJson) });
}

export async function createMeeting(req, res) {
  const { course } = await manageCourse(req, req.params.id);
  const meeting = { courseId: course.id, ...readMeeting(req.body) };
  const warnings = await clashWarnings(meeting);
  const id = await Schedule.create(meeting);
  res.status(201).json({ schedule: toJson(await Schedule.findById(id)), warnings });
}

export async function updateMeeting(req, res) {
  const row = await findManagedMeeting(req);
  const current = toJson(row);
  // The stored times carry seconds; readMeeting compares like with like
  current.startsAt = row.starts_at;
  current.endsAt = row.ends_at;
  const meeting = { id: row.id, courseId: row.course_id, ...readMeeting(req.body, current) };
  const warnings = await clashWarnings(meeting);
  await Schedule.update(meeting);
  res.json({ schedule: toJson(await Schedule.findById(row.id)), warnings });
}

export async function deleteMeeting(req, res) {
  const meeting = await findManagedMeeting(req);
  await Schedule.remove(meeting.id);
  res.status(204).end();
}

// Every meeting across the courses this person teaches or takes, for "My week" and the
// dashboard. Which meetings fall on which date is worked out in the browser, which knows the
// school's calendar day.
export async function mySchedule(req, res) {
  res.json({ schedules: (await Schedule.listForPerson(req.user.id)).map(toJson) });
}

// The longest stretch one request may ask for. A month grid shows at most six weeks (42 days);
// this leaves room, while stopping one request from reading years of deadlines at once.
const MAX_RANGE_DAYS = 62;

// A student's mark on one deadline: 'handedIn', 'late', 'missing' (past due, nothing handed in),
// or 'notYet'. Someone who teaches the course gets null, since the work is not theirs to hand in.
// A quiz cannot be late: once it closes it cannot be taken at all.
function deadlineStatus(row, now) {
  if (row.teaching) return null;
  if (row.submitted_at) return isLate(row, row) ? 'late' : 'handedIn';
  if (Number(row.handed_in) > 0) return 'handedIn';
  return row.due_at < now ? 'missing' : 'notYet';
}

// Assignments due, and quizzes closing, from `from` up to (not including) `to`, for the month
// calendar and the bell's "Coming up". The browser
// sends both as UTC times, because only it knows where the viewer's month starts and ends.
export async function myDeadlines(req, res) {
  const from = optionalDateTime(req.query.from, 'Start');
  const to = optionalDateTime(req.query.to, 'End');
  if (!from || !to) throw new HttpError(400, 'Give both a start and an end');
  if (to <= from) throw new HttpError(400, 'The end must come after the start');
  const days = (Date.parse(`${to}Z`) - Date.parse(`${from}Z`)) / 86400000;
  if (days > MAX_RANGE_DAYS) throw new HttpError(400, `Ask for at most ${MAX_RANGE_DAYS} days at a time`);

  const now = nowUtc();
  const [assignments, quizzes] = await Promise.all([
    Assignment.listDueBetween(req.user.id, from, to),
    Quiz.listClosingBetween(req.user.id, from, to),
  ]);
  const rows = [
    ...assignments.map((row) => ({ ...row, kind: 'assignment' })),
    ...quizzes.map((row) => ({ ...row, kind: 'quiz' })),
  ].sort((a, b) => a.due_at.localeCompare(b.due_at));
  res.json({
    deadlines: rows.map((row) => ({
      kind: row.kind,
      id: row.id,
      title: row.title,
      dueAt: row.due_at,
      courseId: row.course_id,
      courseCode: row.course_code,
      courseTitle: row.course_title,
      status: deadlineStatus(row, now),
    })),
  });
}
