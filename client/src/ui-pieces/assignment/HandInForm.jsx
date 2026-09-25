// A student's work for one assignment: a written answer and files, handed in and changed until it
// is graded. The time shown is the server's record, not the student's own clock.
import { useRef, useState } from 'react';
import { FileText } from 'lucide-react';
import { api, fileDownloadUrl } from '../../api-client/api.js';
import { useToast } from '../../shared-state/ToastContext.jsx';
import useSubmit from '../../reusable-logic/useSubmit.js';
import { formatBytes, formatDateTime } from '../../helpers/format.js';
import { Notice } from '../basics/Feedback.jsx';
import SubmissionStatus from './SubmissionStatus.jsx';

const ACCEPTED = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.jpg,.jpeg,.png,.gif,.webp,.txt,.csv';

export default function HandInForm({ assignment, submission, courseOpen, onChanged }) {
  const toast = useToast();
  const picker = useRef(null);
  const [body, setBody] = useState(submission?.body ?? '');
  const locked = !courseOpen || (submission && submission.status !== 'submitted');

  const handIn = useSubmit(async () => {
    const chosen = picker.current?.files ?? [];
    await api.handIn(assignment.id, body, chosen);
    if (picker.current) picker.current.value = '';
    toast.success(submission ? 'Your changes are handed in.' : 'Handed in.');
    onChanged();
  });

  const removeFile = useSubmit(async (file) => {
    if (!window.confirm(`Remove ${file.name} from your work? This counts as a change, so your hand-in time moves to now.`)) return;
    await api.removeSubmissionFile(submission.id, file.id);
    toast.success(`${file.name} removed.`);
    onChanged();
  });

  return (
    <>
      <div className="card-head">
        <h2>Your work</h2>
        <SubmissionStatus submission={submission} dueAt={assignment.dueAt} maxScore={assignment.maxScore} />
      </div>
      {submission?.status === 'returned' && (
        <div className="inset" aria-label="Your result">
          <p className="metric">
            <span className="metric-value">{submission.score}</span>
            <span className="metric-label">out of {assignment.maxScore}, returned {formatDateTime(submission.gradedAt)}</span>
          </p>
          {submission.feedback ? <p className="prose">{submission.feedback}</p> : <p className="field-hint">No written feedback.</p>}
        </div>
      )}
      {submission && (
        <p className="field-hint">
          Handed in {formatDateTime(submission.submittedAt)}{submission.late ? ', after the due date' : ''}.
        </p>
      )}
      {!courseOpen && <Notice tone="ok">This course is closed, so work can no longer be handed in or changed.</Notice>}
      {courseOpen && submission?.status === 'graded' && (
        <Notice tone="ok">Your work has been marked, so it can no longer be changed. The result appears here when your instructor returns it.</Notice>
      )}

      {submission?.files.length > 0 && (
        <ul className="file-list">
          {submission.files.map((file) => (
            <li key={file.id} className="outline-row">
              <FileText aria-hidden="true" />
              <a href={fileDownloadUrl(file.id)} download>{file.name}</a>
              <span className="field-hint">{formatBytes(file.size)}</span>
              {!locked && (
                <button className="btn btn-sm btn-danger" type="button" onClick={() => removeFile.run(file)} disabled={removeFile.busy}>
                  Remove<span className="visually-hidden"> {file.name}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {locked ? (
        submission?.body && <p className="prose lesson-text">{submission.body}</p>
      ) : (
        <>
          <Notice>{handIn.error || removeFile.error}</Notice>
          <form className="form" noValidate onSubmit={(event) => { event.preventDefault(); handIn.run(); }}>
            <div className="field">
              <label htmlFor="hand-in-body">Written answer</label>
              <textarea className="textarea lesson-textarea" id="hand-in-body" maxLength={50000} value={body}
                onChange={(event) => setBody(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="hand-in-files">{submission ? 'Add more files' : 'Attach files'}</label>
              <input className="input" id="hand-in-files" type="file" multiple accept={ACCEPTED} ref={picker}
                aria-describedby="hand-in-files-hint" />
              <p className="field-hint" id="hand-in-files-hint">Up to 10 files in total, 25 MB each.</p>
            </div>
            <div className="actions">
              <button className="btn btn-primary" type="submit" disabled={handIn.busy} data-loading={handIn.busy}>
                {submission ? 'Hand in changes' : 'Hand in'}
              </button>
            </div>
          </form>
        </>
      )}
    </>
  );
}
