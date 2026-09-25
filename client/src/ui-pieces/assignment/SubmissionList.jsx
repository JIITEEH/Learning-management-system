// For the instructor: every student in the course and what they handed in, with one submission
// opened below the table
import { useState } from 'react';
import { FileText } from 'lucide-react';
import { api, fileDownloadUrl } from '../../api-client/api.js';
import useApi from '../../reusable-logic/useApi.js';
import { formatBytes, formatDateTime } from '../../helpers/format.js';
import { Notice } from '../basics/Feedback.jsx';
import SubmissionStatus from './SubmissionStatus.jsx';

function OpenSubmission({ submissionId }) {
  const { data, error } = useApi(() => api.getSubmission(submissionId), [submissionId]);
  if (error) return <Notice>{error.message}</Notice>;
  if (!data) return null;
  const { submission } = data;
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
    </div>
  );
}

export default function SubmissionList({ assignment }) {
  const { data, error } = useApi(() => api.listSubmissions(assignment.id), [assignment.id]);
  const [openId, setOpenId] = useState(null);
  if (error) return <Notice>{error.message}</Notice>;
  if (!data) return null;
  const handedIn = data.students.filter((student) => student.submission).length;

  return (
    <>
      <div className="card-head">
        <h2>Submissions</h2>
        <span className="tag">{handedIn} of {data.students.length} handed in</span>
      </div>
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
                  <td data-label="Status"><SubmissionStatus submission={submission} dueAt={assignment.dueAt} /></td>
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
      {openId && <OpenSubmission key={openId} submissionId={openId} />}
    </>
  );
}
