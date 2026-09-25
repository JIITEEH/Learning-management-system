// The dashboard: one card per thing this account should know about, and only the cards its role
// has use for (the server decides which sections to send, see dashboardController.js). Every
// number shown is real; there are no placeholders.
import { Link } from 'react-router';
import { BookOpen, CalendarClock, ClipboardCheck, Megaphone, UserCheck } from 'lucide-react';
import { api } from '../api-client/api.js';
import { useAuth } from '../shared-state/AuthContext.jsx';
import useApi from '../reusable-logic/useApi.js';
import { formatDate, formatDue, isPastDue, plural } from '../helpers/format.js';
import { EmptyState, Notice } from '../ui-pieces/basics/Feedback.jsx';

// A dashboard card with a heading, and an empty message when it has nothing to list
function Card({ title, Icon, empty, children, hasItems }) {
  return (
    <section className="card" aria-label={title}>
      <div className="card-head"><h2>{title}</h2></div>
      {hasItems ? children : <EmptyState icon={Icon}>{empty}</EmptyState>}
    </section>
  );
}

function ProgressBar({ done, total }) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="meter" role="img" aria-label={`${done} of ${total} lessons done`}>
      <span className="meter-fill" style={{ '--meter-at': `${percent}%` }}>{percent}%</span>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data, error } = useApi(() => api.getDashboard(), []);
  const firstName = user.fullName.split(/\s+/)[0];

  if (error) return <main className="stack" id="main"><Notice>{error.message}</Notice></main>;
  if (!data) return null;
  const { courses, dueSoon, recentGrades, toGrade, deadlines, announcements, totals } = data;
  const courseLink = (item, kind) => `/courses/${item.courseId}/${kind}/${item.id}`;

  return (
    <main className="board dashboard" id="main">
      <section className="card dashboard-welcome">
        <h1>Welcome back, {firstName}</h1>
        <p className="card-intro">Here is what needs you today.</p>
      </section>

      {totals && (
        <Card title="Accounts" Icon={UserCheck} hasItems>
          <p className="metric">
            <span className="metric-value">{totals.pendingAccounts}</span>
            <span className="metric-label">{totals.pendingAccounts === 1 ? 'account waiting' : 'accounts waiting'} for approval</span>
          </p>
          {totals.pendingAccounts > 0 && (
            <Link className="btn btn-primary" to="/admin/users?status=pending">Review them</Link>
          )}
          <p className="field-hint">
            {plural(totals.accounts, 'account')} in total · {plural(totals.openCourses, 'open course')} of {totals.courses}
          </p>
        </Card>
      )}

      {toGrade && (
        <Card title="To grade" Icon={ClipboardCheck} empty="Nothing waiting to be graded." hasItems={toGrade.length > 0}>
          <ul className="file-list">
            {toGrade.map((item) => (
              <li key={item.id} className="outline-row">
                <Link to={courseLink(item, 'assignments')}>{item.courseCode} · {item.title}</Link>
                <span className="tag tag-info">{item.waiting} waiting</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {dueSoon && (
        <Card title="Due soon" Icon={CalendarClock} empty="Nothing due. Everything with a deadline is handed in." hasItems={dueSoon.length > 0}>
          <ul className="file-list">
            {dueSoon.map((item) => (
              <li key={item.id} className="outline-row">
                <Link to={courseLink(item, 'assignments')}>{item.courseCode} · {item.title}</Link>
                <span className={`tag ${isPastDue(item.dueAt) ? 'tag-warn' : ''}`}>
                  {isPastDue(item.dueAt) ? 'Overdue' : formatDue(item.dueAt)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {courses && (
        <Card title="My courses" Icon={BookOpen} empty="You are not in any course yet. Join one from the Courses page." hasItems={courses.length > 0}>
          <ul className="dashboard-courses">
            {courses.map((course) => (
              <li key={course.id}>
                <Link to={`/courses/${course.id}`}>{course.code} · {course.title}</Link>
                {course.lessonCount > 0 ? (
                  <ProgressBar done={course.lessonsDone} total={course.lessonCount} />
                ) : (
                  <p className="field-hint">No lessons yet.</p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {recentGrades && (
        <Card title="Recent grades" Icon={ClipboardCheck} empty="No grades returned yet." hasItems={recentGrades.length > 0}>
          <ul className="file-list">
            {recentGrades.map((grade) => (
              <li key={grade.assignmentId} className="outline-row">
                <Link to={`/courses/${grade.courseId}/assignments/${grade.assignmentId}`}>{grade.courseCode} · {grade.title}</Link>
                <span className="tag tag-ok">{grade.score}/{grade.maxScore}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {deadlines && (
        <Card title="Upcoming deadlines" Icon={CalendarClock} empty="No deadlines ahead." hasItems={deadlines.length > 0}>
          <ul className="file-list">
            {deadlines.map((item) => (
              <li key={item.id} className="outline-row">
                <Link to={courseLink(item, 'assignments')}>{item.courseCode} · {item.title}</Link>
                <span className="field-hint">{formatDue(item.dueAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {announcements && (
        <Card title="Announcements" Icon={Megaphone} empty="No announcements in your courses." hasItems={announcements.length > 0}>
          <ul className="file-list">
            {announcements.map((item) => (
              <li key={item.id} className="outline-row">
                <Link to={`/courses/${item.courseId}?tab=announcements`}>{item.courseCode} · {item.title}</Link>
                <span className="field-hint">{formatDate(item.createdAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </main>
  );
}
