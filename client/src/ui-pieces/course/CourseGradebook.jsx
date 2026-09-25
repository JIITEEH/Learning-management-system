// The Gradebook tab, for the course's instructor and administrators: every student against every
// assignment, with a total. Totals follow the rule in server/src/helpers/grades.js.
import { api, gradebookCsvUrl } from '../../api-client/api.js';
import useApi from '../../reusable-logic/useApi.js';
import { isPastDue } from '../../helpers/format.js';
import { Notice } from '../basics/Feedback.jsx';

// What one cell shows: the score; "Handed in" when not graded yet; "Missing" when nothing was
// handed in and the due date has passed (it counts as 0 in the total); "–" when not due yet
function Cell({ cell, dueAt }) {
  if (cell.score !== null) return String(cell.score);
  if (cell.status) return <span className="field-hint">Handed in</span>;
  if (isPastDue(dueAt)) return <span className="tag tag-warn">Missing</span>;
  return '–';
}

export default function CourseGradebook({ course }) {
  const { data, error } = useApi(() => api.getGradebook(course.id), [course.id]);
  if (error) return <Notice>{error.message}</Notice>;
  if (!data) return null;
  const { assignments, students } = data;

  return (
    <>
      <div className="card-head">
        <h2>Gradebook</h2>
        <a className="btn" href={gradebookCsvUrl(course.id)} download>Download CSV</a>
      </div>
      <p className="field-hint">
        Scores count as soon as they are saved, returned or not. Missing work counts as 0 once its due date has
        passed; work handed in but not graded yet is left out until it is.
      </p>
      {students.length === 0 || assignments.length === 0 ? (
        <p className="empty">{students.length === 0 ? 'Nobody is enrolled yet.' : 'No assignments yet.'}</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Student</th>
                {assignments.map((assignment) => (
                  <th key={assignment.id} scope="col">{assignment.title} <span className="field-hint">/{assignment.maxScore}</span></th>
                ))}
                <th scope="col">Total</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.userId}>
                  <td className="cell-strong">{student.fullName}</td>
                  {student.cells.map((cell, index) => (
                    <td key={cell.assignmentId} data-label={assignments[index].title} data-numeric>
                      <Cell cell={cell} dueAt={assignments[index].dueAt} />
                      {cell.late && <span className="visually-hidden"> (late)</span>}
                    </td>
                  ))}
                  <td data-label="Total" data-numeric>
                    {student.total.percent === null ? '–' : `${student.total.earned}/${student.total.possible} (${student.total.percent}%)`}
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
