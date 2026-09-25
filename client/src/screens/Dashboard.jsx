// The dashboard. Every card is still a placeholder from the design pass: it shows a dash rather
// than a number, because the lessons, deadlines and schedules it would report do not exist yet.
// Roadmap step 9 fills it in once there is something real to count.
import { Link } from 'react-router';
import { BookOpen, Calendar, CalendarClock, ChevronLeft, ChevronRight, CircleCheck, Clock, User } from 'lucide-react';
import { EmptyState } from '../ui-pieces/basics/Feedback.jsx';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TALLIES = [
  { tone: 'primary', label: 'In progress', Icon: Clock },
  { tone: 'ok', label: 'Completed', Icon: CircleCheck },
  { tone: 'warn', label: 'Upcoming', Icon: CalendarClock },
];

function PersonAvatar() {
  return (
    <span className="avatar" aria-hidden="true">
      <User />
    </span>
  );
}

export default function Dashboard() {
  return (
    <main className="board" id="main">
      <h1 className="visually-hidden">Dashboard</h1>

      <section className="card card-activity" aria-labelledby="activity-title">
        <div className="card-head">
          <h2 id="activity-title">Activity</h2>
          <button className="chip" type="button" disabled>
            <Calendar aria-hidden="true" />
            Last 7 days
          </button>
        </div>
        <p className="metric">
          <span className="metric-value placeholder">—</span>
          <span className="metric-label">Hours spent</span>
        </p>
        <div className="chart" data-empty="true" role="img" aria-label="Hours studied per day. No activity recorded yet.">
          {DAYS.map((day) => (
            <div key={day} className="chart-col"><span className="chart-bar" /></div>
          ))}
        </div>
        <div className="chart-days" aria-hidden="true">
          {DAYS.map((day) => <span key={day}>{day}</span>)}
        </div>
        <p className="chart-note">No activity recorded yet.</p>
        <div className="inset">
          <h3>By course</h3>
          <EmptyState icon={BookOpen}>Time spent will break down by course once you are enrolled in one.</EmptyState>
        </div>
      </section>

      <section className="card card-progress" aria-labelledby="progress-title">
        <div className="card-head">
          <h2 id="progress-title">Progress statistics</h2>
        </div>
        <p className="metric">
          <span className="metric-value placeholder">—</span>
          <span className="metric-label">Total activity</span>
        </p>
        <div className="segments">
          {TALLIES.map(({ tone }) => (
            <div key={tone} className="segment" data-tone={tone}>
              <span className="segment-bar" />
              <span className="segment-label placeholder">—</span>
            </div>
          ))}
        </div>
        <div className="inset tally">
          {TALLIES.map(({ tone, label, Icon }) => (
            <div key={tone} className="tally-cell" data-tone={tone}>
              <span className="tally-mark"><Icon aria-hidden="true" /></span>
              <span className="tally-value placeholder">—</span>
              <span className="tally-label">{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card card-feature" aria-labelledby="feature-title">
        <div className="feature-tags">
          <span className="tag tag-ok">No course selected</span>
          <span className="tag tag-info">—</span>
        </div>
        <h2 id="feature-title" className="placeholder">No course to continue yet</h2>
        <p>
          When you are enrolled in a course, the one you are partway through appears here with its participants and your
          progress.
        </p>
        <div className="feature-split">
          <div className="inset">
            <span className="field-label">Participants</span>
            <div className="avatar-stack" aria-label="No participants yet">
              <PersonAvatar /><PersonAvatar /><PersonAvatar />
            </div>
          </div>
          <div className="inset">
            <span className="field-label">Course progress</span>
            <div className="meter" role="img" aria-label="No progress recorded yet">
              <span className="meter-fill placeholder">—</span>
            </div>
          </div>
        </div>
        <Link className="btn btn-contrast btn-block" to="/courses">Browse courses</Link>
      </section>

      <section className="card card-schedule" aria-labelledby="schedule-title">
        <div className="card-head">
          <h2 id="schedule-title">My schedule</h2>
          <div className="stepper">
            <button className="stepper-btn" type="button" disabled>
              <span className="visually-hidden">Previous day</span>
              <ChevronLeft aria-hidden="true" />
            </button>
            <span className="stepper-label">Today</span>
            <button className="stepper-btn" type="button" disabled>
              <span className="visually-hidden">Next day</span>
              <ChevronRight aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="schedule-grid">
          {[1, 2, 3].map((slot) => (
            <article key={slot} className="session">
              <div className="session-top">
                <span className="session-time placeholder">—:— — —:—</span>
              </div>
              <h3 className="placeholder">No session scheduled</h3>
              <span className="tag session-tag">—</span>
              <div className="session-mentor">
                <PersonAvatar />
                <span>
                  <span className="session-mentor-name placeholder">—</span>
                  <br />
                  <span className="session-mentor-role">Instructor</span>
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
