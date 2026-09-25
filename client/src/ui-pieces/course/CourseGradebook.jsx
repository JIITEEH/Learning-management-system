// The Gradebook tab, for the course's instructor and administrators: every student against every
// assignment, with a total. Totals follow the rule in server/src/helpers/grades.js.
import { api, gradebookCsvUrl } from '../../api-client/api.js';
import useApi from '../../reusable-logic/useApi.js';
import { Notice } from '../basics/Feedback.jsx';

// What one cell shows: the score, "in" when handed in but not graded, "–" when nothing
function cellText(cell) {
  if (cell.score !== null) return String(cell.score);
  return cell.status ? 'in' : '–';
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
        Scores count as soon as they are saved, returned or not. Missing work counts as 0 once past its due date;
        "in" means handed in but not graded yet.
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
                      {cellText(cell)}{cell.late && <span className="visually-hidden"> (late)</span>}
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
