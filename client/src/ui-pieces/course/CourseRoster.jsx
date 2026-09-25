// The People tab: everyone enrolled in the course, for its instructor or an administrator
import { useState } from 'react';
import { api } from '../../api-client/api.js';
import { useAuth } from '../../shared-state/AuthContext.jsx';
import { useToast } from '../../shared-state/ToastContext.jsx';
import useApi from '../../reusable-logic/useApi.js';
import useSubmit from '../../reusable-logic/useSubmit.js';
import { formatDate } from '../../helpers/format.js';
import { Notice } from '../basics/Feedback.jsx';

const ENROLLMENT_STATUSES = { active: 'Active', completed: 'Completed', dropped: 'Dropped' };

export default function CourseRoster({ courseId }) {
  const { can } = useAuth();
  const toast = useToast();
  const { data, error, reload } = useApi(() => api.getRoster(courseId), [courseId]);
  const [email, setEmail] = useState('');
  const enrollments = data?.enrollments ?? [];
  const activeCount = enrollments.filter((row) => row.status === 'active').length;
  const canManage = can('enrollment.manage');

  const add = useSubmit(async () => {
    if (!email.trim()) throw new Error("Type the student's email address first.");
    const { enrollment } = await api.addToCourse(courseId, email.trim());
    setEmail('');
    toast.success(`${enrollment.fullName} added.`);
    reload();
  });

  // A status change saves straight away: one field per row, so a separate Save button would only
  // be one more thing to forget
  async function changeStatus(row, status) {
    try {
      await api.setEnrollmentStatus(row.id, status);
      toast.success(`${row.fullName} is now ${ENROLLMENT_STATUSES[status].toLowerCase()}.`);
      reload();
    } catch (failure) {
      toast.error(failure.message);
    }
  }

  async function remove(row) {
    const sure = window.confirm(
      `Remove ${row.fullName} from this course? They could rejoin with the join code. ` +
        'To keep them out, and keep a record that they took part, set them to Dropped instead.',
    );
    if (!sure) return;
    try {
      await api.removeEnrollment(row.id);
      toast.success(`${row.fullName} removed.`);
      reload();
    } catch (failure) {
      toast.error(failure.message);
    }
  }

  return (
    <>
      <div className="card-head">
        <h2>People</h2>
        <span className="tag">{data ? `${activeCount} active of ${enrollments.length}` : '—'}</span>
      </div>

      <Notice>{add.error || error?.message}</Notice>
      {canManage && (
        <form className="form join-form" noValidate onSubmit={(event) => { event.preventDefault(); add.run(); }}>
          <div className="field">
            <label htmlFor="add-email">Add a student by email address</label>
            <input className="input" id="add-email" type="email" autoComplete="off" required
              value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <button className="btn btn-primary" type="submit" disabled={add.busy} data-loading={add.busy}>Add</button>
        </form>
      )}

      {data && enrollments.length === 0 ? (
        <p className="empty">Nobody is enrolled yet. Share the join code, or add students above.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email address</th>
                <th scope="col">Enrolled</th>
                <th scope="col">Status</th>
                <th scope="col"><span className="visually-hidden">Action</span></th>
              </tr>
            </thead>
            <tbody>
              {enrollments.map((row) => (
                <tr key={row.id}>
                  <td className="cell-strong">{row.fullName}</td>
                  <td data-label="Email address">{row.email}</td>
                  <td data-label="Enrolled">{formatDate(row.enrolledAt)}</td>
                  <td data-label="Status">
                    {canManage ? (
                      <>
                        <label className="visually-hidden" htmlFor={`enrollment-${row.id}`}>Status of {row.fullName}</label>
                        <select className="select select-sm" id={`enrollment-${row.id}`} value={row.status}
                          onChange={(event) => changeStatus(row, event.target.value)}>
                          {Object.entries(ENROLLMENT_STATUSES).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </>
                    ) : (
                      ENROLLMENT_STATUSES[row.status] ?? row.status
                    )}
                  </td>
                  <td className="cell-action">
                    {canManage && (
                      <button className="btn btn-sm btn-danger" type="button" onClick={() => remove(row)}>
                        Remove<span className="visually-hidden"> {row.fullName}</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
