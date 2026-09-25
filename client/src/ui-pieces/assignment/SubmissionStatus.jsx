// The tags that say where a piece of work stands: "Not handed in", "Handed in", "Late", "Graded"
import { isPastDue } from '../../helpers/format.js';

export default function SubmissionStatus({ submission, dueAt }) {
  if (!submission) {
    return <span className={`tag ${isPastDue(dueAt) ? 'tag-warn' : ''}`}>Not handed in</span>;
  }
  return (
    <span className="tag-row">
      <span className="tag tag-ok">{submission.status === 'submitted' ? 'Handed in' : 'Graded'}</span>
      {submission.late && <span className="tag tag-warn">Late</span>}
    </span>
  );
}
