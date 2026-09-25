// One lesson, at /courses/:courseId/lessons/:lessonId: its text, its files, and buttons for the
// previous and next lesson. A student can mark it done; its instructor and administrators can
// edit it, attach files, and delete it. The server checks every one of those again.
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, ArrowRight, CircleCheck } from 'lucide-react';
import { api } from '../api-client/api.js';
import { useAuth } from '../shared-state/AuthContext.jsx';
import { useToast } from '../shared-state/ToastContext.jsx';
import useApi from '../reusable-logic/useApi.js';
import useSubmit from '../reusable-logic/useSubmit.js';
import { Notice } from '../ui-pieces/basics/Feedback.jsx';
import LessonFiles from '../ui-pieces/lesson/LessonFiles.jsx';
import LessonText from '../ui-pieces/lesson/LessonText.jsx';

function LessonEditor({ lesson, onSaved, onCancel }) {
  const toast = useToast();
  const [form, setForm] = useState({ title: lesson.title, content: lesson.content });
  const save = useSubmit(async () => {
    if (!form.title.trim()) throw new Error('A lesson needs a title.');
    await api.updateLesson(lesson.id, form);
    toast.success('Lesson saved.');
    onSaved();
  });

  return (
    <>
      <Notice>{save.error}</Notice>
      <form className="form" noValidate onSubmit={(event) => { event.preventDefault(); save.run(); }}>
        <div className="field">
          <label htmlFor="lesson-title">Title</label>
          <input className="input" id="lesson-title" maxLength={200} required value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="lesson-content">Text</label>
          <textarea className="textarea lesson-textarea" id="lesson-content" maxLength={50000}
            aria-describedby="lesson-content-hint" value={form.content}
            onChange={(event) => setForm({ ...form, content: event.target.value })} />
          <p className="field-hint" id="lesson-content-hint">
            Plain text. Leave a blank line between paragraphs; web addresses become links.
          </p>
        </div>
        <div className="actions">
          <button className="btn btn-primary" type="submit" disabled={save.busy} data-loading={save.busy}>Save lesson</button>
          <button className="btn" type="button" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </>
  );
}

// A student's "Mark as done" switch
function DoneButton({ lesson, onChanged }) {
  const toast = useToast();
  const toggle = useSubmit(async () => {
    await api.setLessonDone(lesson.id, !lesson.completed);
    toast.success(lesson.completed ? 'Marked as not done.' : 'Marked as done.');
    onChanged();
  });
  return (
    <>
      <Notice>{toggle.error}</Notice>
      <button className={lesson.completed ? 'btn' : 'btn btn-primary'} type="button" onClick={toggle.run}
        aria-pressed={lesson.completed} disabled={toggle.busy} data-loading={toggle.busy}>
        {lesson.completed ? <><CircleCheck aria-hidden="true" /> Done. Mark as not done</> : 'Mark as done'}
      </button>
    </>
  );
}

function LessonNotFound({ courseId }) {
  return (
    <main className="stack" id="main">
      <section className="card">
        <h1>Lesson not found</h1>
        <p className="card-intro">There is no lesson at this address that your account can open.</p>
        <div className="actions"><Link className="btn" to={`/courses/${courseId}`}>Back to the course</Link></div>
      </section>
    </main>
  );
}

export default function Lesson() {
  const { courseId, lessonId } = useParams();
  const { can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { data, error, reload } = useApi(() => api.getLesson(lessonId), [lessonId]);
  const [editing, setEditing] = useState(false);

  const remove = useSubmit(async () => {
    if (!window.confirm(`Delete "${data.lesson.title}", its files and students' progress on it? This cannot be undone.`)) return;
    await api.deleteLesson(data.lesson.id);
    toast.success('Lesson deleted.');
    navigate(`/courses/${data.course.id}`);
  });

  if (error?.status === 404) return <LessonNotFound courseId={courseId} />;
  if (error) return <main className="stack" id="main"><Notice>{error.message}</Notice></main>;
  if (!data) return null;

  const { lesson, course, files, previous, next } = data;
  const manages = (course.relation === 'teaching' || course.relation === 'overseeing') && can('lesson.manage');
  const lessonUrl = (other) => `/courses/${course.id}/lessons/${other.id}`;

  return (
    <main className="stack" id="main">
      <title>{`${lesson.title} — ${course.title}`}</title>

      <section className="card" aria-labelledby="lesson-title-heading">
        <Link className="back-link" to={`/courses/${course.id}`}>
          <ArrowLeft aria-hidden="true" />
          {course.code} · {course.title}
        </Link>
        <span className="tag-row">
          <span className="tag">{lesson.moduleTitle}</span>
        </span>
        <h1 id="lesson-title-heading" className="course-title">{lesson.title}</h1>

        {editing ? (
          <LessonEditor lesson={lesson} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); reload(); }} />
        ) : (
          <LessonText text={lesson.content} />
        )}

        {!editing && (
          <div className="actions">
            {lesson.completed !== null && <DoneButton lesson={lesson} onChanged={reload} />}
            {manages && <button className="btn" type="button" onClick={() => setEditing(true)}>Edit lesson</button>}
            {manages && (
              <button className="btn btn-danger" type="button" onClick={remove.run} disabled={remove.busy} data-loading={remove.busy}>
                Delete lesson
              </button>
            )}
          </div>
        )}
        <Notice>{remove.error}</Notice>
      </section>

      <section className="card" aria-label="Files">
        <LessonFiles lessonId={lesson.id} files={files} canManage={manages && can('file.upload')} onChanged={reload} />
      </section>

      <nav className="lesson-nav" aria-label="Other lessons">
        {previous ? (
          <Link className="btn" to={lessonUrl(previous)}>
            <ArrowLeft aria-hidden="true" /> <span className="visually-hidden">Previous lesson: </span>{previous.title}
          </Link>
        ) : <span />}
        {next && (
          <Link className="btn btn-primary" to={lessonUrl(next)}>
            <span className="visually-hidden">Next lesson: </span>{next.title} <ArrowRight aria-hidden="true" />
          </Link>
        )}
      </nav>
    </main>
  );
}
