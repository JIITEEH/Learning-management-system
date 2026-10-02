// "Deadlines": a month calendar of assignment due dates and quiz closing times across every
// course this person teaches or takes, with buttons to move a month back or forward. A student sees a mark on each one
// (handed in, late, missing). Days outside the month are shown dimmed, with their deadlines too,
// so the last week of one month and the first of the next read the same either way.
//
// Due dates are stored in UTC; each one is placed on the day it falls on in the viewer's own time
// zone, the same day the assignment page shows.
import { useState } from 'react';
import { Link } from 'react-router';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../../api-client/api.js';
import useApi from '../../reusable-logic/useApi.js';
import { parseTimestamp } from '../../helpers/format.js';
import { DAY_NAMES, WEEK_ORDER, addDays, dayString, deadlineLink, monthGrid } from '../../helpers/schedule.js';
import { Notice } from '../basics/Feedback.jsx';
import DueBadge from './DueBadge.jsx';

const firstOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);
const monthName = (date) => date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
const fullDate = (date) => date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
const dueTime = (date) => date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export default function MonthView() {
  const [month, setMonth] = useState(() => firstOfMonth(new Date()));
  const days = monthGrid(month);
  const start = days[0];
  const end = addDays(days[days.length - 1], 1);
  const { data, error } = useApi(() => api.myDeadlines(start, end), [dayString(month)]);
  const today = dayString(new Date());
  const isThisMonth = dayString(month) === dayString(firstOfMonth(new Date()));
  const moveMonth = (by) => setMonth(new Date(month.getFullYear(), month.getMonth() + by, 1));

  // Deadlines grouped by the local day they fall on: { '2026-10-14': [ ... ] }
  const byDay = {};
  for (const deadline of data?.deadlines ?? []) {
    const due = parseTimestamp(deadline.dueAt);
    const key = dayString(due);
    (byDay[key] ??= []).push({ ...deadline, due });
  }
  const total = data?.deadlines.length ?? 0;

  return (
    <>
      <div className="card-head">
        <h2>Deadlines</h2>
        <div className="week-nav">
          <button className="icon-btn" type="button" onClick={() => moveMonth(-1)}>
            <span className="visually-hidden">Previous month</span>
            <ChevronLeft aria-hidden="true" />
          </button>
          <span className="week-label" aria-live="polite">{monthName(month)}</span>
          <button className="icon-btn" type="button" onClick={() => moveMonth(1)}>
            <span className="visually-hidden">Next month</span>
            <ChevronRight aria-hidden="true" />
          </button>
          {!isThisMonth && <button className="btn btn-sm" type="button" onClick={() => setMonth(firstOfMonth(new Date()))}>This month</button>}
        </div>
      </div>

      <Notice>{error?.message}</Notice>
      {data && total === 0 && <p className="field-hint">Nothing is due in these weeks.</p>}

      {/* The weekday names, for the grid; on a phone the days are a list and each says its own name */}
      <div className="month-head" aria-hidden="true">
        {WEEK_ORDER.map((day) => <span key={day}>{DAY_NAMES[day].slice(0, 3)}</span>)}
      </div>
      <ol className="month-grid">
        {days.map((date) => {
          const key = dayString(date);
          const deadlines = byDay[key] ?? [];
          const classes = ['month-day'];
          if (date.getMonth() !== month.getMonth()) classes.push('month-day-outside');
          if (deadlines.length === 0) classes.push('month-day-empty');
          return (
            <li key={key} className={classes.join(' ')} aria-current={key === today ? 'date' : undefined}>
              <p className="month-date">
                <span aria-hidden="true">{date.getDate()}</span>
                <span className="month-date-full">{fullDate(date)}{key === today ? ' · Today' : ''}</span>
              </p>
              {deadlines.map((deadline) => (
                <article key={`${deadline.kind}-${deadline.id}`} className="meeting">
                  <span className="meeting-time" data-numeric>
                    {dueTime(deadline.due)}{deadline.kind === 'quiz' ? ' · Quiz closes' : ''}
                  </span>
                  <Link to={deadlineLink(deadline)} title={deadline.courseTitle}>
                    {deadline.courseCode} · {deadline.title}
                    <span className="visually-hidden"> ({deadline.courseTitle})</span>
                  </Link>
                  <DueBadge status={deadline.status} />
                </article>
              ))}
            </li>
          );
        })}
      </ol>
    </>
  );
}
