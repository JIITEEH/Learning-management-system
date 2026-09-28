// "My week": every class across the courses this person teaches or takes, Monday to Sunday, with
// buttons to move a week back or forward. Today is marked. Which meetings fall on which date is
// worked out here from each meeting's weekday and date range.
import { useState } from 'react';
import { Link } from 'react-router';
import { CalendarDays, ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import { api } from '../api-client/api.js';
import useApi from '../reusable-logic/useApi.js';
import { DAY_NAMES, addDays, dayString, meetingsOn, mondayOf, timeRange } from '../helpers/schedule.js';
import { EmptyState, Notice } from '../ui-pieces/basics/Feedback.jsx';

const shortDate = (date) => date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export default function Schedule() {
  const { data, error } = useApi(() => api.mySchedule(), []);
  const [monday, setMonday] = useState(() => mondayOf(new Date()));
  const today = dayString(new Date());
  const days = Array.from({ length: 7 }, (_, index) => addDays(monday, index));
  const isThisWeek = dayString(monday) === dayString(mondayOf(new Date()));

  if (error) return <main className="stack" id="main"><Notice>{error.message}</Notice></main>;
  if (!data) return null;

  return (
    <main className="stack stack-wide" id="main">
      <section className="card" aria-labelledby="schedule-title">
        <div className="card-head">
          <h1 id="schedule-title">My week</h1>
          <div className="week-nav">
            <button className="icon-btn" type="button" onClick={() => setMonday(addDays(monday, -7))}>
              <span className="visually-hidden">Previous week</span>
              <ChevronLeft aria-hidden="true" />
            </button>
            <span className="week-label" aria-live="polite">{shortDate(days[0])} – {shortDate(days[6])}</span>
            <button className="icon-btn" type="button" onClick={() => setMonday(addDays(monday, 7))}>
              <span className="visually-hidden">Next week</span>
              <ChevronRight aria-hidden="true" />
            </button>
            {!isThisWeek && <button className="btn btn-sm" type="button" onClick={() => setMonday(mondayOf(new Date()))}>This week</button>}
          </div>
        </div>

        {data.schedules.length === 0 ? (
          <EmptyState icon={CalendarDays}>No weekly classes yet. They appear here once your courses have a timetable.</EmptyState>
        ) : (
          <ol className="week-grid">
            {days.map((date) => {
              const meetings = meetingsOn(date, data.schedules);
              const isToday = dayString(date) === today;
              return (
                <li key={dayString(date)} className="week-day" aria-current={isToday ? 'date' : undefined}>
                  <h2 className="week-day-name">
                    {DAY_NAMES[date.getDay()]} <span className="field-hint">{shortDate(date)}{isToday ? ' · Today' : ''}</span>
                  </h2>
                  {meetings.length === 0 ? (
                    <p className="field-hint">No classes</p>
                  ) : (
                    meetings.map((meeting) => (
                      <article key={meeting.id} className="meeting">
                        <span className="meeting-time" data-numeric>{timeRange(meeting)}</span>
                        {/* The course code keeps a narrow day column readable; the full title is in the
                            tooltip and read out by screen readers */}
                        <Link to={`/courses/${meeting.courseId}?tab=schedule`} title={meeting.courseTitle}>
                          {meeting.courseCode} · {meeting.title ?? 'Class'}
                          <span className="visually-hidden"> ({meeting.courseTitle})</span>
                        </Link>
                        {meeting.location && <span className="field-hint"><MapPin aria-hidden="true" /> {meeting.location}</span>}
                      </article>
                    ))
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </main>
  );
}
