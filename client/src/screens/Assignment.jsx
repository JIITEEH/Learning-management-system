// One assignment, at /courses/:courseId/assignments/:assignmentId. A student reads it and hands in
// work; its instructor and administrators edit or delete it and see every student's submission.
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../api-client/api.js';
import { useAuth } from '../shared-state/AuthContext.jsx';
import { useToast } from '../shared-state/ToastContext.jsx';
import useApi from '../reusable-logic/useApi.js';
import useSubmit from '../reusable-logic/useSubmit.js';
import { formatDue } from '../helpers/format.js';
import AssignmentForm from '../ui-pieces/assignment/AssignmentForm.jsx';
import HandInForm from '../ui-pieces/assignment/HandInForm.jsx';
import SubmissionList from '../ui-pieces/assignment/SubmissionList.jsx';
import { Notice } from '../ui-pieces/basics/Feedback.jsx';
import LessonText from '../ui-pieces/lesson/LessonText.jsx';

function AssignmentNotFound({ courseId }) {
  return (
    <main className="stack" id="main">
      <section className="card">
        <h1>Assignment not found</h1>
        <p className="card-intro">There is no assignment at this address that your account can open.</p>
        <div className="actions"><Link className="btn" to={`/courses/${courseId}`}>Back to the course</Link></div>
      </section>
    </main>
  );
}

export default function Assignment() {
  const { courseId, assignmentId } = useParams();
  const { can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { data, error, reload } = useApi(() => api.getAssignment(assignmentId), [assignmentId]);
  const [editing, setEditing] = useState(false);

  const remove = useSubmit(async () => {
    const sure = window.confirm(`Delete "${data.assignment.title}" and every submission to it, with their files? This cannot be undone.`);
    if (!sure) return;
    await api.deleteAssignment(data.assignment.id);
    toast.success('Assignment deleted.');
    navigate(`/courses/${data.course.id}`);
  });

  if (error?.status === 404) return <AssignmentNotFound courseId={courseId} />;
  if (error) return <main className="stack" id="main"><Notice>{error.message}</Notice></main>;
  if (!data) return null;

  const { assignment, course, mySubmission } = data;
  const manages = (course.relation === 'teaching' || course.relation === 'overseeing') && can('assignment.manage');

  async function save(fields) {
    await api.updateAssignment(assignment.id, fields);
    toast.success('Assignment saved.');
    setEditing(false);
    reload();
  }

  return (
    <main className="stack" id="main">
      <title>{`${assignment.title} — ${course.title}`}</title>

      <section className="card" aria-labelledby="assignment-title">
        <span className="tag-row">
          <Link className="tag" to={`/courses/${course.id}`}>{course.code} · {course.title}</Link>
          <span className="tag">Out of {assignment.maxScore}</span>
        </span>
        <h1 id="assignment-title" className="course-title">{assignment.title}</h1>
        <p className="card-intro">Due {formatDue(assignment.dueAt)}</p>

        {editing ? (
          <AssignmentForm assignment={assignment} submitLabel="Save assignment" onSave={save} onCancel={() => setEditing(false)} />
        ) : (
          <LessonText text={assignment.instructions} emptyText="No instructions." />
        )}

        {manages && !editing && (
          <div className="actions">
            <button className="btn" type="button" onClick={() => setEditing(true)}>Edit assignment</button>
            <button className="btn btn-danger" type="button" onClick={remove.run} disabled={remove.busy} data-loading={remove.busy}>
              Delete assignment
            </button>
          </div>
        )}
        <Notice>{remove.error}</Notice>
      </section>

      {course.relation === 'enrolled' && can('submission.create') && (
        <section className="card" aria-label="Your work">
          <HandInForm key={mySubmission?.submittedAt ?? 'new'} assignment={assignment} submission={mySubmission}
            courseOpen={course.status === 'published'} onChanged={reload} />
        </section>
      )}

      {manages && can('submission.read') && (
        <section className="card" aria-label="Submissions">
          <SubmissionList assignment={assignment} />
        </section>
      )}
    </main>
  );
}
