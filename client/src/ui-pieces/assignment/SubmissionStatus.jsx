// The tags that say where a piece of work stands. What a student is shown depends on whether the
// grade has been returned: before that, the server does not even send them the score.
//   no submission   "Not handed in" (amber once past due)
//   submitted       "Handed in"
//   graded          staff: "Graded 42/50"   student: "Marked, not returned yet"
//   returned        "Returned 42/50"
// plus "Late" when it was handed in after the due date
import { isPastDue } from '../../helpers/format.js';

export default function SubmissionStatus({ submission, dueAt, maxScore }) {
  if (!submission) {
    return <span className={`tag ${isPastDue(dueAt) ? 'tag-warn' : ''}`}>Not handed in</span>;
  }
  const outOf = (score) => `${score}/${maxScore}`;
  let label = 'Handed in';
  let tone = 'tag-ok';
  if (submission.status === 'graded') {
    label = submission.score === null ? 'Marked, not returned yet' : `Graded ${outOf(submission.score)}`;
    tone = 'tag-info';
  } else if (submission.status === 'returned') {
    label = `Returned ${outOf(submission.score)}`;
  }
  return (
    <span className="tag-row">
      <span className={`tag ${tone}`}>{label}</span>
      {submission.late && <span className="tag tag-warn">Late</span>}
    </span>
  );
}
