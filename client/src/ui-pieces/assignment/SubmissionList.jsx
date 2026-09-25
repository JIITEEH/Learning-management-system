// For the instructor: every student in the course and what they handed in, with one submission
// opened below the table
import { useState } from 'react';
import { useToast } from '../../shared-state/ToastContext.jsx';
import useSubmit from '../../reusable-logic/useSubmit.js';
import { FileText } from 'lucide-react';
import { api, fileDownloadUrl } from '../../api-client/api.js';
import useApi from '../../reusable-logic/useApi.js';
import { formatBytes, formatDateTime } from '../../helpers/format.js';
import { Notice } from '../basics/Feedback.jsx';
import SubmissionStatus from './SubmissionStatus.jsx';

// Score and feedback for one submission, and returning it to the student
function GradeForm({ submission, maxScore, onChanged }) {
  const toast = useToast();
  const [score, setScore] = useState(submission.score === null ? '' : String(submission.score));
  const [feedback, setFeedback] = useState(submission.feedback ?? '');
  const prefix = `grade-${submission.id}`;

  const save = useSubmit(async () => {
    if (score === '') throw new Error('Enter a score first.');
    await api.gradeSubmission(submission.id, Number(score), feedback);
    toast.success(submission.status === 'returned' ? 'Grade corrected. The student sees the change.' : 'Grade saved. The student sees it once you return it.');
    onChanged();
  });
  const giveBack = useSubmit(async () => {
    await api.returnSubmission(submission.id);
    toast.success(`Returned to ${submission.fullName}.`);
    onChanged();
  });

  return (
    <>
      <Notice>{save.error || giveBack.error}</Notice>
      <form className="form" noValidate onSubmit={(event) => { event.preventDefault(); save.run(); }}>
        <div className="form-row">
          <div className="field">
            <label htmlFor={`${prefix}-score`}>Score (out of {maxScore})</label>
            <input className="input" id={`${prefix}-score`} type="number" min="0" max={maxScore} step="0.01"
              value={score} onChange={(event) => setScore(event.target.value)} />
          </div>
        </div>
        <div className="field">
          <label htmlFor={`${prefix}-feedback`}>Feedback</label>
          <textarea className="textarea" id={`${prefix}-feedback`} maxLength={10000} value={feedback}
            onChange={(event) => setFeedback(event.target.value)} />
        </div>
        <div className="actions">
          <button className="btn btn-primary" type="submit" disabled={save.busy} data-loading={save.busy}>
            {submission.status === 'submitted' ? 'Save grade' : 'Update grade'}
          </button>
          {submission.status === 'graded' && (
            <button className="btn" type="button" onClick={giveBack.run} disabled={giveBack.busy} data-loading={giveBack.busy}>
              Return to student
            </button>
          )}
        </div>
        <p className="field-hint">
          {submission.status === 'returned'
            ? 'Returned: the student can see this grade.'
            : 'Not returned yet: the student cannot see a grade.'}
        </p>
      </form>
    </>
  );
}

function OpenSubmission({ submissionId, maxScore, onChanged }) {
  const { data, error, reload } = useApi(() => api.getSubmission(submissionId), [submissionId]);
  if (error) return <Notice>{error.message}</Notice>;
  if (!data) return null;
  const { submission } = data;
  const changed = () => { reload(); onChanged(); };
  return (
    <div className="inset subhead" aria-live="polite">
      <h3>{submission.fullName}</h3>
      <p className="field-hint">Handed in {formatDateTime(submission.submittedAt)}{submission.late ? ', after the due date' : ''}.</p>
      {submission.body ? <p className="prose lesson-text">{submission.body}</p> : <p className="placeholder">No written answer.</p>}
      {submission.files.length > 0 && (
        <ul className="file-list">
          {submission.files.map((file) => (
            <li key={file.id} className="outline-row">
              <FileText aria-hidden="true" />
              <a href={fileDownloadUrl(file.id)} download>{file.name}</a>
              <span className="field-hint">{formatBytes(file.size)}</span>
            </li>
          ))}
        </ul>
      )}
      <h3 className="subhead">Grade</h3>
      <GradeForm key={`${submission.id}-${submission.gradedAt}`} submission={submission} maxScore={maxScore} onChanged={changed} />
    </div>
  );
}

export default function SubmissionList({ assignment }) {
  const toast = useToast();
  const { data, error, reload } = useApi(() => api.listSubmissions(assignment.id), [assignment.id]);
  const [openId, setOpenId] = useState(null);
  const returnAll = useSubmit(async () => {
    const { returned } = await api.returnAllGraded(assignment.id);
    toast.success(returned === 1 ? '1 grade returned.' : `${returned} grades returned.`);
    reload();
  });
  if (error) return <Notice>{error.message}</Notice>;
  if (!data) return null;
  const handedIn = data.students.filter((student) => student.submission).length;
  const waitingToReturn = data.students.filter((student) => student.submission?.status === 'graded').length;

  return (
    <>
      <div className="card-head">
        <h2>Submissions</h2>
        <span className="tag">{handedIn} of {data.students.length} handed in</span>
      </div>
      <Notice>{returnAll.error}</Notice>
      {waitingToReturn > 0 && (
        <div className="actions">
          <button className="btn btn-primary" type="button" onClick={returnAll.run} disabled={returnAll.busy} data-loading={returnAll.busy}>
            Return all graded ({waitingToReturn})
          </button>
        </div>
      )}
      {data.students.length === 0 ? (
        <p className="empty">Nobody is enrolled in this course yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Student</th>
                <th scope="col">Status</th>
                <th scope="col">Handed in</th>
                <th scope="col">Files</th>
                <th scope="col"><span className="visually-hidden">Action</span></th>
              </tr>
            </thead>
            <tbody>
              {data.students.map(({ userId, fullName, submission }) => (
                <tr key={userId} aria-current={submission && submission.id === openId ? 'true' : undefined}>
                  <td className="cell-strong">{fullName}</td>
                  <td data-label="Status"><SubmissionStatus submission={submission} dueAt={assignment.dueAt} maxScore={assignment.maxScore} /></td>
                  <td data-label="Handed in">{submission ? formatDateTime(submission.submittedAt) : '—'}</td>
                  <td data-label="Files">{submission ? submission.fileCount : '—'}</td>
                  <td className="cell-action">
                    {submission && (
                      <button className="btn btn-sm" type="button" onClick={() => setOpenId(submission.id)}>
                        Open<span className="visually-hidden"> {fullName}'s work</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {openId && <OpenSubmission key={openId} submissionId={openId} maxScore={assignment.maxScore} onChanged={reload} />}
    </>
  );
}
