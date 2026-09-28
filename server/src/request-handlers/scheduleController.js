// Weekly class meetings: a course's list, adding, editing and removing them, and a person's own
// timetable across all their courses. Overlapping meetings in one course are allowed (a split lab
// is on purpose) but the reply carries a warning naming what it overlaps.
import * as Schedule from '../database-queries/scheduleModel.js';
import { HttpError } from '../helpers/httpError.js';
import { optionalText, parseId, readDay, requireNumber, requireTime } from '../helpers/validate.js';
import { manageCourse, reachCourse } from '../permission-rules/access.js';

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
