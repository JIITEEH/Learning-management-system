// The courses list: every course the account teaches or takes (every course, for an
// administrator), a box to join one with a code, and a form to create one. Each part appears
// only for an account that may use it.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { BookOpen } from 'lucide-react';
import { api } from '../api-client/api.js';
import { useAuth } from '../shared-state/AuthContext.jsx';
import { useToast } from '../shared-state/ToastContext.jsx';
import useApi from '../reusable-logic/useApi.js';
import useSubmit from '../reusable-logic/useSubmit.js';
import { courseStatus, plural, relationLabel } from '../helpers/format.js';
import { EmptyState, Notice } from '../ui-pieces/basics/Feedback.jsx';

function CourseCard({ course }) {
  const status = courseStatus(course.status);
  return (
    <Link className="card link-card course-card" to={`/courses/${course.id}`}>
      <span className="tag-row">
        <span className="tag">{course.code}</span>
        <span className={`tag ${status.tone}`}>{status.label}</span>
      </span>
      <h3>{course.title}</h3>
      <p>
        {course.instructorName ?? 'No instructor'} · {plural(course.studentCount, 'student')}
      </p>
      <span className="field-hint">{relationLabel(course.relation)}</span>
    </Link>
  );
}

function NewCourseForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ code: '', title: '', description: '' });
  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  const create = useSubmit(async () => {
    if (!form.code.trim() || !form.title.trim()) throw new Error('A course needs both a code and a title.');
    const { course } = await api.createCourse(form);
    navigate(`/courses/${course.id}`);
  });

  return (
    <div className="inset" id="new-course">
      <h2>New course</h2>
      <p className="card-intro">It starts as a draft that only you can see. Publish it when it is ready for students.</p>
      <Notice>{create.error}</Notice>
      <form className="form" noValidate onSubmit={(event) => { event.preventDefault(); create.run(); }}>
        <div className="form-row">
          <div className="field">
            <label htmlFor="new-code">Course code</label>
            <input className="input" id="new-code" maxLength={32} required autoFocus autoCapitalize="characters"
              spellCheck="false" placeholder="CS101" aria-describedby="new-code-hint"
              value={form.code} onChange={update('code')} />
            <p className="field-hint" id="new-code-hint">The public code, as printed in the timetable.</p>
          </div>
          <div className="field">
            <label htmlFor="new-title">Title</label>
            <input className="input" id="new-title" maxLength={200} required value={form.title} onChange={update('title')} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="new-description">Description</label>
          <textarea className="textarea" id="new-description" maxLength={5000} value={form.description}
            onChange={update('description')} />
        </div>
        <div className="actions">
          <button className="btn btn-primary" type="submit" disabled={create.busy} data-loading={create.busy}>
            Create course
          </button>
        </div>
      </form>
    </div>
  );
}

function JoinCourse({ onJoined }) {
  const toast = useToast();
  const [joinCode, setJoinCode] = useState('');

  const join = useSubmit(async () => {
    if (!joinCode.trim()) throw new Error('Type the join code first.');
    const { course } = await api.joinCourse(joinCode.trim());
    setJoinCode('');
    toast.success(`You joined ${course.title}.`);
    onJoined();
  });

  return (
    <section className="card" aria-labelledby="join-title">
      <h2 id="join-title">Join a course</h2>
      <p className="card-intro">Type the join code your instructor gave you.</p>
      <Notice>{join.error}</Notice>
      <form className="form join-form" noValidate onSubmit={(event) => { event.preventDefault(); join.run(); }}>
        <div className="field">
          <label htmlFor="join-code">Join code</label>
          <input className="input join-input" id="join-code" maxLength={12} required autoComplete="off"
            autoCapitalize="characters" spellCheck="false" placeholder="ABCD-EFGH"
            value={joinCode} onChange={(event) => setJoinCode(event.target.value)} />
        </div>
        <button className="btn btn-primary" type="submit" disabled={join.busy} data-loading={join.busy}>Join</button>
      </form>
    </section>
  );
}

export default function Courses() {
  const { can } = useAuth();
  const { data, error, reload } = useApi(() => api.listCourses(), []);
  const [creating, setCreating] = useState(false);
  const courses = data?.courses ?? [];

  return (
    <main className="stack stack-wide" id="main">
      <section className="card" aria-labelledby="courses-title">
        <div className="card-head">
          <h1 id="courses-title">Courses</h1>
          {can('course.create') && (
            <button className="btn btn-primary" type="button" aria-expanded={creating} aria-controls="new-course"
              onClick={() => setCreating((open) => !open)}>
              New course
            </button>
          )}
        </div>
        <p className="card-intro">
          {can('course.manage_any')
            ? 'Every course in the system. You can open and manage any of them.'
            : 'The courses you teach or are taking.'}
        </p>
        {creating && <NewCourseForm />}
      </section>

      {can('enrollment.self') && <JoinCourse onJoined={reload} />}

      <section aria-labelledby="list-title">
        <h2 className="visually-hidden" id="list-title">Your courses</h2>
        <Notice>{error?.message}</Notice>
        {data && courses.length === 0 ? (
          <EmptyState icon={BookOpen} card>
            {can('course.create')
              ? 'No courses yet. Create one with the New course button.'
              : 'You are not in any course yet. Join one with the code your instructor gave you.'}
          </EmptyState>
        ) : (
          <div className="course-grid">
            {courses.map((course) => <CourseCard key={course.id} course={course} />)}
          </div>
        )}
      </section>
    </main>
  );
}
