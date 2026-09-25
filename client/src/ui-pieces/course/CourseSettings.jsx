// What the course's instructor (or an administrator) can change on the Overview tab: the join
// code, who can see the course, its details, and deleting it. Each part shows only for someone
// holding the permission it needs; the server checks the same permissions again.
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../../api-client/api.js';
import { useAuth } from '../../shared-state/AuthContext.jsx';
import { useToast } from '../../shared-state/ToastContext.jsx';
import useSubmit from '../../reusable-logic/useSubmit.js';
import { formatJoinCode } from '../../helpers/format.js';
import { Notice } from '../basics/Feedback.jsx';

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft: only the instructor and administrators' },
  { value: 'published', label: 'Open: enrolled students, and new students can join' },
  { value: 'archived', label: 'Archived: enrolled students can still look, nobody new can join' },
];

// `onSaved` receives the course as the server now has it
export default function CourseSettings({ course, onSaved }) {
  const { can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [status, setStatus] = useState(course.status);
  const [details, setDetails] = useState({
    code: course.code,
    title: course.title,
    description: course.description ?? '',
  });
  const update = (field) => (event) => setDetails({ ...details, [field]: event.target.value });

  const newCode = useSubmit(async () => {
    const sure = window.confirm(
      'Make a new join code? The current one stops working straight away. Students already enrolled are not affected.',
    );
    if (!sure) return;
    onSaved((await api.newJoinCode(course.id)).course);
    toast.success('New join code made.');
  });

  const saveStatus = useSubmit(async () => {
    onSaved((await api.setCourseStatus(course.id, status)).course);
    toast.success('Status saved.');
  });

  const saveDetails = useSubmit(async () => {
    onSaved((await api.updateCourse(course.id, details)).course);
    toast.success('Details saved.');
  });

  const remove = useSubmit(async () => {
    if (!window.confirm(`Delete ${course.title}? Its enrollments go with it, and this cannot be undone.`)) return;
    await api.deleteCourse(course.id);
    toast.success(`${course.title} deleted.`);
    navigate('/courses');
  });

  return (
    <>
      <div className="inset join-panel">
        <div>
          <h3>Join code</h3>
          <p className="field-hint">
            Students type this on the Courses page to enroll themselves. It only works while the course is open.
          </p>
        </div>
        <p className="join-code">{formatJoinCode(course.joinCode)}</p>
        {can('course.update') && (
          <button className="btn" type="button" onClick={newCode.run} disabled={newCode.busy} data-loading={newCode.busy}>
            Make a new code
          </button>
        )}
      </div>
      <Notice>{newCode.error}</Notice>

      {can('course.publish') && (
        <>
          <h3 className="subhead">Status</h3>
          <Notice>{saveStatus.error}</Notice>
          <form className="form" noValidate onSubmit={(event) => { event.preventDefault(); saveStatus.run(); }}>
            <div className="field">
              <label htmlFor="course-status">Who can see this course</label>
              <select className="select" id="course-status" value={status} onChange={(event) => setStatus(event.target.value)}>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="actions">
              <button className="btn btn-primary" type="submit" disabled={saveStatus.busy} data-loading={saveStatus.busy}>
                Save status
              </button>
            </div>
          </form>
        </>
      )}

      {can('course.update') && (
        <>
          <h3 className="subhead">Details</h3>
          <Notice>{saveDetails.error || remove.error}</Notice>
          <form className="form" noValidate onSubmit={(event) => { event.preventDefault(); saveDetails.run(); }}>
            <div className="form-row">
              <div className="field">
                <label htmlFor="course-code">Course code</label>
                <input className="input" id="course-code" maxLength={32} required autoCapitalize="characters"
                  spellCheck="false" value={details.code} onChange={update('code')} />
              </div>
              <div className="field">
                <label htmlFor="course-title-input">Title</label>
                <input className="input" id="course-title-input" maxLength={200} required
                  value={details.title} onChange={update('title')} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="course-description">Description</label>
              <textarea className="textarea" id="course-description" maxLength={5000}
                value={details.description} onChange={update('description')} />
            </div>
            <div className="actions">
              <button className="btn btn-primary" type="submit" disabled={saveDetails.busy} data-loading={saveDetails.busy}>
                Save details
              </button>
              {can('course.delete') && (
                <button className="btn btn-danger" type="button" onClick={remove.run}
                  disabled={course.status === 'published' || remove.busy} data-loading={remove.busy}>
                  Delete course
                </button>
              )}
            </div>
            {can('course.delete') && course.status === 'published' && (
              <p className="field-hint">An open course must be archived before it can be deleted.</p>
            )}
          </form>
        </>
      )}
    </>
  );
}
