// The Assignments tab: a course's assignments, soonest due first. A student sees where their own
// work stands on each; the instructor sees how many have handed in, and can add an assignment.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { api } from '../../api-client/api.js';
import { useAuth } from '../../shared-state/AuthContext.jsx';
import useApi from '../../reusable-logic/useApi.js';
import { formatDue } from '../../helpers/format.js';
import AssignmentForm from '../assignment/AssignmentForm.jsx';
import SubmissionStatus from '../assignment/SubmissionStatus.jsx';
import { Notice } from '../basics/Feedback.jsx';

export default function CourseAssignments({ course }) {
  const { can } = useAuth();
  const navigate = useNavigate();
  const { data, error } = useApi(() => api.listAssignments(course.id), [course.id]);
  const [creating, setCreating] = useState(false);
  const manages = (course.relation === 'teaching' || course.relation === 'overseeing') && can('assignment.manage');
  const assignments = data?.assignments ?? [];

  async function create(fields) {
    const { assignment } = await api.createAssignment(course.id, fields);
    navigate(`/courses/${course.id}/assignments/${assignment.id}`);
  }

  if (error) return <Notice>{error.message}</Notice>;
  if (!data) return null;

  return (
    <>
      <div className="card-head">
        <h2>Assignments</h2>
        {manages && (
          <button className="btn btn-primary" type="button" aria-expanded={creating} aria-controls="new-assignment"
            onClick={() => setCreating((open) => !open)}>
            New assignment
          </button>
        )}
      </div>
      {creating && (
        <div className="inset" id="new-assignment">
          <AssignmentForm assignment={null} submitLabel="Create assignment" onSave={create} onCancel={() => setCreating(false)} />
        </div>
      )}

      {assignments.length === 0 ? (
        <p className="empty">{manages ? 'No assignments yet.' : 'Your instructor has not set any assignments yet.'}</p>
      ) : (
        <ul className="file-list">
          {assignments.map((assignment) => (
            <li key={assignment.id} className="outline-row">
              <Link to={`/courses/${course.id}/assignments/${assignment.id}`}>{assignment.title}</Link>
              <span className="field-hint">{formatDue(assignment.dueAt)}</span>
              {'mySubmission' in assignment ? (
                <SubmissionStatus submission={assignment.mySubmission} dueAt={assignment.dueAt} />
              ) : (
                <span className="tag">{assignment.submissionCount} handed in</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
