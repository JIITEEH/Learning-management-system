// One course, at /courses/:id. Everyone who can see it gets the Overview. Its instructor and
// administrators also get the settings and the People tab; which of those appear follows the
// `relation` the server reports, and the server checks again on every change.
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { api } from '../api-client/api.js';
import { useAuth } from '../shared-state/AuthContext.jsx';
import useApi from '../reusable-logic/useApi.js';
import { courseStatus, plural, relationLabel } from '../helpers/format.js';
import { Notice } from '../ui-pieces/basics/Feedback.jsx';
import Tabs from '../ui-pieces/basics/Tabs.jsx';
import CourseRoster from '../ui-pieces/course/CourseRoster.jsx';
import CourseSettings from '../ui-pieces/course/CourseSettings.jsx';

// The same answer for a course that does not exist and one this account may not see: the server
// answers 404 for both, so an outsider cannot learn which course ids exist
function CourseNotFound() {
  return (
    <main className="stack stack-wide" id="main">
      <section className="card">
        <h1>Course not found</h1>
        <p className="card-intro">
          There is no course at this address that your account can open. If you were given a join code, use it on the
          Courses page.
        </p>
        <div className="actions"><Link className="btn" to="/courses">Back to courses</Link></div>
      </section>
    </main>
  );
}

export default function Course() {
  const { id } = useParams();
  const { can } = useAuth();
  const { data, error } = useApi(() => api.getCourse(id), [id]);
  // Kept separately so a save can show the server's updated copy without reloading the page
  const [course, setCourse] = useState(null);
  useEffect(() => setCourse(data?.course ?? null), [data]);

  if (error?.status === 404) return <CourseNotFound />;
  if (error) return <main className="stack" id="main"><Notice>{error.message}</Notice></main>;
  if (!course) return null;

  const status = courseStatus(course.status);
  const manages = course.relation === 'teaching' || course.relation === 'overseeing';

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <>
          <h2>About this course</h2>
          <p className={`card-intro prose${course.description ? '' : ' placeholder'}`}>
            {course.description || 'No description yet.'}
          </p>
          {manages && <CourseSettings key={course.id} course={course} onSaved={setCourse} />}
        </>
      ),
    },
    manages && can('enrollment.read') && { id: 'people', label: 'People', content: <CourseRoster courseId={course.id} /> },
    { id: 'lessons', label: 'Lessons', content: <><h2>Lessons</h2><p className="empty">Modules and lessons arrive in the next step of the build.</p></> },
    { id: 'assignments', label: 'Assignments', content: <><h2>Assignments</h2><p className="empty">Assignments and submissions arrive in a later step of the build.</p></> },
    { id: 'schedule', label: 'Schedule', content: <><h2>Schedule</h2><p className="empty">Weekly class meetings arrive in a later step of the build.</p></> },
  ].filter(Boolean);

  return (
    <main className="stack stack-wide" id="main">
      <title>{`${course.title} — LearnHub`}</title>
      <Tabs label="Course sections" tabs={tabs}>
        <span className="tag-row">
          <span className="tag">{course.code}</span>
          <span className={`tag ${status.tone}`}>{status.label}</span>
          <span className="tag">{relationLabel(course.relation)}</span>
        </span>
        <h1 id="course-title" className="course-title">{course.title}</h1>
        <p className="card-intro">
          Taught by {course.instructorName ?? 'nobody yet'} · {plural(course.studentCount, 'student')}
        </p>
      </Tabs>
    </main>
  );
}
