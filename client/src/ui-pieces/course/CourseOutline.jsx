// The Lessons tab: the course's modules and their lessons, in order. Students see a tick on each
// lesson they have finished and a progress bar; the instructor and administrators can add,
// rename, reorder and delete. The server checks every change again.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowDown, ArrowUp, CircleCheck } from 'lucide-react';
import { api } from '../../api-client/api.js';
import { useAuth } from '../../shared-state/AuthContext.jsx';
import { useToast } from '../../shared-state/ToastContext.jsx';
import useApi from '../../reusable-logic/useApi.js';
import useSubmit from '../../reusable-logic/useSubmit.js';
import { Notice } from '../basics/Feedback.jsx';

// A one-field form for adding a module or a lesson. `thing` is 'module' or 'lesson'.
// If `onAdd` fails, its message shows above the form and the typed title is kept.
function AddForm({ id, thing, onAdd }) {
  const [title, setTitle] = useState('');
  const add = useSubmit(async () => {
    if (!title.trim()) throw new Error(`Type a title for the ${thing} first.`);
    await onAdd(title.trim());
    setTitle('');
  });
  return (
    <>
      <Notice>{add.error}</Notice>
      <form className="form join-form" noValidate onSubmit={(event) => { event.preventDefault(); add.run(); }}>
        <div className="field">
          <label htmlFor={id}>New {thing} title</label>
          <input className="input" id={id} maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} />
        </div>
        <button className="btn" type="submit" disabled={add.busy} data-loading={add.busy}>Add {thing}</button>
      </form>
    </>
  );
}

// ↑ and ↓ buttons. `label` names the item for screen readers ("Move Week 1 up").
function MoveButtons({ label, isFirst, isLast, onMove }) {
  return (
    <span className="outline-tools">
      <button className="icon-btn" type="button" disabled={isFirst} onClick={() => onMove('up')}>
        <span className="visually-hidden">Move {label} up</span>
        <ArrowUp aria-hidden="true" />
      </button>
      <button className="icon-btn" type="button" disabled={isLast} onClick={() => onMove('down')}>
        <span className="visually-hidden">Move {label} down</span>
        <ArrowDown aria-hidden="true" />
      </button>
    </span>
  );
}

export default function CourseOutline({ course }) {
  const { can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { data, error, reload } = useApi(() => api.getOutline(course.id), [course.id]);
  const manages = (course.relation === 'teaching' || course.relation === 'overseeing') && can('lesson.manage');
  const modules = data?.modules ?? [];
  const progress = data?.progress;

  // Runs a change, then reloads the outline so it shows the server's version
  async function change(action, doneMessage) {
    try {
      await action();
      if (doneMessage) toast.success(doneMessage);
      reload();
    } catch (failure) {
      toast.error(failure.message);
    }
  }

  function renameModule(courseModule) {
    const title = window.prompt('New name for this module', courseModule.title);
    if (title && title.trim() !== courseModule.title) {
      change(() => api.renameModule(courseModule.id, title.trim()), 'Module renamed.');
    }
  }

  function deleteModule(courseModule) {
    const sure = window.confirm(
      `Delete "${courseModule.title}" and its ${courseModule.lessons.length} lesson(s)? Their files and students' progress go too. This cannot be undone.`,
    );
    if (sure) change(() => api.deleteModule(courseModule.id), 'Module deleted.');
  }

  async function addModule(title) {
    await api.createModule(course.id, title);
    toast.success('Module added.');
    reload();
  }

  // A new lesson opens straight away, ready for its text and files
  async function addLesson(moduleId, title) {
    const { lesson } = await api.createLesson(moduleId, title);
    navigate(`/courses/${course.id}/lessons/${lesson.id}`);
  }

  if (error) return <Notice>{error.message}</Notice>;
  if (!data) return null;

  return (
    <>
      <div className="card-head">
        <h2>Lessons</h2>
        {progress && <span className="tag">{progress.completed} of {progress.total} done</span>}
      </div>

      {progress && progress.total > 0 && (
        <div className="meter" role="img" aria-label={`${progress.completed} of ${progress.total} lessons done`}>
          <span className="meter-fill" style={{ '--meter-at': `${Math.round((progress.completed / progress.total) * 100)}%` }}>
            {Math.round((progress.completed / progress.total) * 100)}%
          </span>
        </div>
      )}

      {modules.length === 0 && (
        <p className="empty">
          {manages ? 'No modules yet. Add the first one below.' : 'Your instructor has not added any lessons yet.'}
        </p>
      )}

      {modules.map((courseModule, moduleIndex) => (
        <section key={courseModule.id} className="inset outline-module" aria-labelledby={`module-${courseModule.id}`}>
          <div className="outline-row">
            <h3 id={`module-${courseModule.id}`}>{courseModule.title}</h3>
            {manages && (
              <span className="outline-tools">
                <MoveButtons
                  label={courseModule.title}
                  isFirst={moduleIndex === 0}
                  isLast={moduleIndex === modules.length - 1}
                  onMove={(direction) => change(() => api.moveModule(courseModule.id, direction))}
                />
                <button className="btn btn-sm" type="button" onClick={() => renameModule(courseModule)}>
                  Rename<span className="visually-hidden"> {courseModule.title}</span>
                </button>
                <button className="btn btn-sm btn-danger" type="button" onClick={() => deleteModule(courseModule)}>
                  Delete<span className="visually-hidden"> {courseModule.title}</span>
                </button>
              </span>
            )}
          </div>

          {courseModule.lessons.length > 0 ? (
            <ol className="outline-lessons">
              {courseModule.lessons.map((lesson, lessonIndex) => (
                <li key={lesson.id} className="outline-row">
                  <Link to={`/courses/${course.id}/lessons/${lesson.id}`}>{lesson.title}</Link>
                  {lesson.completed && (
                    <span className="outline-done">
                      <CircleCheck aria-hidden="true" />
                      <span className="visually-hidden">Done</span>
                    </span>
                  )}
                  {manages && (
                    <MoveButtons
                      label={lesson.title}
                      isFirst={lessonIndex === 0}
                      isLast={lessonIndex === courseModule.lessons.length - 1}
                      onMove={(direction) => change(() => api.moveLesson(lesson.id, direction))}
                    />
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="field-hint">No lessons in this module yet.</p>
          )}

          {manages && (
            <AddForm id={`add-lesson-${courseModule.id}`} thing="lesson" onAdd={(title) => addLesson(courseModule.id, title)} />
          )}
        </section>
      ))}

      {manages && (
        <div className="subhead">
          <AddForm id="add-module" thing="module" onAdd={addModule} />
        </div>
      )}
    </>
  );
}
